import {
  HospitalNode,
  HospitalEdge,
  NavigationRoute,
  RouteStep,
  LanguageCode,
} from '../../../shared/types';
import { HOSPITAL_NODES, HOSPITAL_EDGES } from '../../../shared/hospitalData';

export class NavigationService {
  private static nodes: Map<string, HospitalNode> = new Map(
    HOSPITAL_NODES.map((n) => [n.id, n])
  );

  public static getNodes(): HospitalNode[] {
    return HOSPITAL_NODES;
  }

  public static getEdges(): HospitalEdge[] {
    return HOSPITAL_EDGES;
  }

  public static getNodeById(id: string): HospitalNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Fuzzy matches search term or OCR extracted text to the nearest hospital node
   */
  public static fuzzyFindNode(term: string): HospitalNode | null {
    if (!term) return null;
    const clean = term.toLowerCase().trim();

    // 1. Direct match by room or ward number
    const roomMatch = clean.match(/(?:room|कमरा|அறை)\s*(\d+)/i) || clean.match(/r-?(\d+)/i);
    if (roomMatch) {
      const roomNum = `Room ${roomMatch[1]}`;
      const found = HOSPITAL_NODES.find(
        (n) => n.roomNumber && n.roomNumber.toLowerCase() === roomNum.toLowerCase()
      );
      if (found) return found;
    }

    const wardMatch = clean.match(/(?:ward|वार्ड|வார்டு)\s*(\d+)/i) || clean.match(/w-?(\d+)/i);
    if (wardMatch) {
      const wardId = `node-ward-${wardMatch[1]}`;
      const found = this.nodes.get(wardId);
      if (found) return found;
    }

    // 2. Exact or substring match in name, departmentId, type
    for (const node of HOSPITAL_NODES) {
      const name = node.name.toLowerCase();
      if (name.includes(clean) || clean.includes(name)) return node;
      if (node.departmentId && clean.includes(node.departmentId.replace('dept-', ''))) {
        return node;
      }
      if (node.type && clean.includes(node.type)) return node;
    }

    // 3. Keyword associations
    if (clean.includes('ortho') || clean.includes('हड्डी') || clean.includes('எலும்பு')) {
      return this.nodes.get('node-room-12') || null;
    }
    if (clean.includes('gyn') || clean.includes('स्त्री') || clean.includes('மகப்பேறு')) {
      return this.nodes.get('node-room-14') || null;
    }
    if (clean.includes('paed') || clean.includes('child') || clean.includes('बच्चे') || clean.includes('குழந்தை')) {
      return this.nodes.get('node-room-5') || null;
    }
    if (clean.includes('water') || clean.includes('पानी') || clean.includes('தண்ணீர்')) {
      return this.nodes.get('node-water-point-g') || null;
    }
    if (clean.includes('pharm') || clean.includes('दवा') || clean.includes('மருந்து')) {
      return this.nodes.get('node-pharmacy') || null;
    }
    if (clean.includes('lab') || clean.includes('जांच') || clean.includes('பரிசோதனை')) {
      return this.nodes.get('node-lab-ground') || null;
    }
    if (clean.includes('emerg') || clean.includes('आपातकालीन') || clean.includes('அவசரம்')) {
      return this.nodes.get('node-emergency') || null;
    }
    if (clean.includes('toilet') || clean.includes('restroom') || clean.includes('शौचालय')) {
      return this.nodes.get('node-toilet-g') || null;
    }

    return null;
  }

  /**
   * Dijkstra shortest path finding with wheelchair accessibility filter
   */
  public static findRoute(
    fromNodeId: string,
    toNodeId: string,
    accessibleOnly: boolean = false,
    language: LanguageCode = 'en'
  ): NavigationRoute {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);

    if (!fromNode || !toNode) {
      throw new Error(`Invalid navigation endpoints: ${fromNodeId} to ${toNodeId}`);
    }

    // Build adjacency list
    const adjacency = new Map<string, { node: string; edge: HospitalEdge; weight: number }[]>();
    for (const edge of HOSPITAL_EDGES) {
      // If accessibleOnly is requested, filter out stairs and non-accessible edges
      if (accessibleOnly && (!edge.accessible || edge.isStairs)) {
        continue;
      }

      // Lift penalty or distance
      const weight = edge.distanceMeters;

      // Bidirectional edges
      if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
      if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);

      adjacency.get(edge.from)!.push({ node: edge.to, edge, weight });
      adjacency.get(edge.to)!.push({ node: edge.from, edge, weight });
    }

    // Dijkstra algorithm
    const distances = new Map<string, number>();
    const previous = new Map<string, { from: string; edge: HospitalEdge }>();
    const unvisited = new Set<string>();

    for (const node of HOSPITAL_NODES) {
      distances.set(node.id, Infinity);
      unvisited.add(node.id);
    }
    distances.set(fromNodeId, 0);

    while (unvisited.size > 0) {
      let currentId: string | null = null;
      let smallestDist = Infinity;

      for (const id of unvisited) {
        const d = distances.get(id)!;
        if (d < smallestDist) {
          smallestDist = d;
          currentId = id;
        }
      }

      if (!currentId || smallestDist === Infinity) break;
      if (currentId === toNodeId) break;

      unvisited.delete(currentId);

      const neighbors = adjacency.get(currentId) || [];
      for (const { node: neighborId, edge, weight } of neighbors) {
        if (!unvisited.has(neighborId)) continue;

        const candidateDist = distances.get(currentId)! + weight;
        if (candidateDist < distances.get(neighborId)!) {
          distances.set(neighborId, candidateDist);
          previous.set(neighborId, { from: currentId, edge });
        }
      }
    }

    // Reconstruct path
    const pathNodeIds: string[] = [];
    const pathEdges: HospitalEdge[] = [];
    let curr = toNodeId;

    while (curr !== fromNodeId) {
      pathNodeIds.unshift(curr);
      const prev = previous.get(curr);
      if (!prev) {
        // Fallback: direct hop if disconnected
        pathNodeIds.unshift(fromNodeId);
        break;
      }
      pathEdges.unshift(prev.edge);
      curr = prev.from;
    }
    if (pathNodeIds[0] !== fromNodeId) {
      pathNodeIds.unshift(fromNodeId);
    }

    // Generate step-by-step directions
    const steps: RouteStep[] = [];
    const floorTransitions: { fromFloor: number; toFloor: number; via: 'lift' | 'stairs' | 'ramp' }[] = [];
    let totalDist = 0;

    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      const uId = pathNodeIds[i];
      const vId = pathNodeIds[i + 1];
      const u = this.nodes.get(uId)!;
      const v = this.nodes.get(vId)!;
      const edge = pathEdges[i];

      const dist = edge ? edge.distanceMeters : 10;
      totalDist += dist;

      if (u.floor !== v.floor) {
        const via = edge?.isLift ? 'lift' : edge?.isRamp ? 'ramp' : 'stairs';
        floorTransitions.push({
          fromFloor: u.floor,
          toFloor: v.floor,
          via,
        });
      }

      // Localized instruction
      const instruction = this.buildInstruction(u, v, edge, language, i + 1, pathNodeIds.length - 1);

      // Landmark info if present on u or v
      const landmarkNode = v.landmarkImage ? v : u.landmarkImage ? u : undefined;

      steps.push({
        stepNumber: i + 1,
        instruction,
        fromNodeId: u.id,
        toNodeId: v.id,
        fromNodeName: u.name,
        toNodeName: v.name,
        floor: v.floor,
        block: v.block,
        distanceMeters: dist,
        landmark: landmarkNode
          ? {
              name: landmarkNode.name,
              image: landmarkNode.landmarkImage,
              icon: landmarkNode.landmarkIcon,
            }
          : undefined,
        isStairs: edge?.isStairs,
        isLift: edge?.isLift,
      });
    }

    // Walking speed: ~1 meter per second (~60m per minute)
    const totalTimeMinutes = Math.max(1, Math.ceil(totalDist / 45));

    return {
      fromNode,
      toNode,
      steps,
      totalDistanceMeters: totalDist,
      totalTimeMinutes,
      isAccessible: accessibleOnly || !pathEdges.some((e) => e.isStairs),
      floorTransitions,
      pathNodeIds,
    };
  }

  private static buildInstruction(
    u: HospitalNode,
    v: HospitalNode,
    edge: HospitalEdge | undefined,
    lang: LanguageCode,
    stepIdx: number,
    totalSteps: number
  ): string {
    const isDestination = stepIdx === totalSteps;

    // Check specific edge instruction
    if (edge?.instructions && (edge.instructions as any)[lang]) {
      return (edge.instructions as any)[lang];
    }

    // Multilingual templates
    if (u.floor !== v.floor) {
      const mode = edge?.isLift ? 'elevator / lift' : 'stairs';
      if (lang === 'hi') {
        return `${edge?.isLift ? 'लिफ्ट' : 'सीढ़ियों'} से मंजिल ${v.floor} पर जाएं।`;
      }
      if (lang === 'ta') {
        return `${edge?.isLift ? 'மின்தூக்கி (Lift)' : 'படிகள்'} வழியாக தளம் ${v.floor} க்குச் செல்லவும்.`;
      }
      return `Take the ${mode} up to Floor ${v.floor}.`;
    }

    if (isDestination) {
      if (lang === 'hi') return `आप अपनी मंजिल ${v.name} पर पहुंच गए हैं।`;
      if (lang === 'ta') return `உங்கள் இலக்கான ${v.name} வந்துவிட்டது.`;
      return `You have arrived at your destination: ${v.name}.`;
    }

    if (edge?.instructions?.en) {
      return edge.instructions.en;
    }

    if (lang === 'hi') return `${v.name} की ओर आगे बढ़ें (${edge?.distanceMeters || 10} मीटर)।`;
    if (lang === 'ta') return `${v.name} நோக்கி நேராக செல்லவும்.`;
    return `Walk straight towards ${v.name} (${edge?.distanceMeters || 10}m).`;
  }
}
