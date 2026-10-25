import { NavigationService } from '../services/navigation.service';

export function testNavigationLogic(): boolean {
  console.log('--- RUNNING TEST: Dijkstra Pathfinding & Accessible Routing ---');

  // Test 1: Standard route from Entrance to Ward 4
  const standardRoute = NavigationService.findRoute(
    'node-main-entrance',
    'node-ward-4',
    false,
    'en'
  );

  if (!standardRoute || standardRoute.steps.length === 0) {
    throw new Error('Failed to find route from entrance to Ward 4');
  }

  if (standardRoute.pathNodeIds[0] !== 'node-main-entrance') {
    throw new Error('Route does not start at main entrance');
  }

  if (standardRoute.pathNodeIds[standardRoute.pathNodeIds.length - 1] !== 'node-ward-4') {
    throw new Error('Route does not end at Ward 4');
  }

  console.log(`Standard route to Ward 4 has ${standardRoute.steps.length} steps, distance: ${standardRoute.totalDistanceMeters}m`);

  // Test 2: Accessible route (wheelchair / avoid stairs)
  const wheelchairRoute = NavigationService.findRoute(
    'node-main-entrance',
    'node-ward-4',
    true,
    'en'
  );

  if (!wheelchairRoute.isAccessible) {
    throw new Error('Wheelchair route is marked as not accessible');
  }

  const hasStairs = wheelchairRoute.steps.some((s) => s.isStairs);
  if (hasStairs) {
    throw new Error('Wheelchair route erroneously contains stairs!');
  }

  console.log('✓ Accessible routing successfully avoided stairs and used elevator.');

  // Test 3: Fuzzy matching of room/ward
  const fuzzyWard4 = NavigationService.fuzzyFindNode('Ward 4');
  if (!fuzzyWard4 || fuzzyWard4.id !== 'node-ward-4') {
    throw new Error(`Fuzzy match for "Ward 4" failed. Got: ${fuzzyWard4?.id}`);
  }

  const fuzzyRoom12 = NavigationService.fuzzyFindNode('Room 12');
  if (!fuzzyRoom12 || fuzzyRoom12.id !== 'node-room-12') {
    throw new Error(`Fuzzy match for "Room 12" failed. Got: ${fuzzyRoom12?.id}`);
  }

  console.log('✓ Fuzzy search matched Ward 4 and Room 12 accurately.');
  return true;
}
