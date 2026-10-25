import { Server as SocketIOServer } from 'socket.io';
import { db } from '../db';
import { SimulatedMessage } from '../../../shared/types';

let ioInstance: SocketIOServer | null = null;

export function initializeSocketIO(io: SocketIOServer) {
  ioInstance = io;

  io.on('connection', (socket) => {
    // Join room for specific patient token or staff role
    socket.on('join:patient', (patientId: string) => {
      socket.join(`patient:${patientId}`);
    });

    socket.on('join:token', (tokenNumber: string) => {
      socket.join(`token:${tokenNumber}`);
    });

    socket.on('join:role', (role: string) => {
      socket.join(`role:${role}`);
    });
  });
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function broadcastQueueUpdate(departmentId?: string) {
  if (ioInstance) {
    ioInstance.emit('queue:updated', { departmentId, timestamp: new Date().toISOString() });
    ioInstance.emit('display:update', { timestamp: new Date().toISOString() });
  }
}

export function notifyTokenCalled(token: any, patient: any, doctor: any) {
  if (!ioInstance) return;

  const payload = {
    tokenNumber: token.tokenNumber,
    opdNumber: token.opdNumber,
    patientName: patient?.name || 'Patient',
    doctorName: doctor?.name || 'Doctor',
    roomNumber: doctor?.roomNumber || 'Consultation Room',
    departmentId: token.departmentId,
    calledAt: new Date().toISOString(),
  };

  ioInstance.to(`token:${token.tokenNumber}`).emit('token:called', payload);
  if (token.patientId) {
    ioInstance.to(`patient:${token.patientId}`).emit('token:called', payload);
  }
  ioInstance.emit('token:called_public', payload);
  ioInstance.emit('display:update', payload);

  // Send simulated SMS/WhatsApp message
  if (patient?.phone) {
    const messageContent = `Sahai Setu Alert: Token ${token.tokenNumber} for ${patient.name} is now called! Please proceed immediately to ${doctor?.roomNumber || 'Room 12'} (${doctor?.name || 'OPD'}).`;
    db.addSimulatedMessage(patient.id, patient.phone, 'SMS', 'Turn Alert', messageContent);
    db.addSimulatedMessage(patient.id, patient.phone, 'WhatsApp', 'OPD Calling Your Turn', messageContent);
  }
}

export function notifyEmergencyTriggered(alert: any) {
  if (!ioInstance) return;
  ioInstance.emit('emergency:alert', alert);
  ioInstance.to('role:triage_nurse').emit('emergency:alert', alert);
  ioInstance.to('role:admin').emit('emergency:alert', alert);
}

export function notifyAssistanceRequested(req: any) {
  if (!ioInstance) return;
  ioInstance.emit('assistance:new', req);
  ioInstance.to('role:counter_staff').emit('assistance:new', req);
  ioInstance.to('role:admin').emit('assistance:new', req);
}

export function broadcastAnnouncement(message: string, languages: string[] = []) {
  if (!ioInstance) return;
  ioInstance.emit('broadcast:message', {
    id: 'bc-' + Date.now(),
    message,
    languages,
    timestamp: new Date().toISOString(),
  });
}
