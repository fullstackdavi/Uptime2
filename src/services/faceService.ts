import * as faceapi from 'face-api.js';

export const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';

export async function loadModels() {
  console.log('Loading face-api models from mirror...');
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    console.log('Face-api models loaded successfully.');
  } catch (err) {
    console.error('Failed to load face-api models:', err);
    throw err;
  }
}

export interface UserEncoding {
  name: string;
  encoding: number[];
}

export async function fetchUserEncodings(): Promise<UserEncoding[]> {
  const res = await fetch('/api/users/encodings');
  if (!res.ok) throw new Error('Failed to fetch encodings');
  return res.json();
}

export async function registerUser(name: string, phone: string, encoding: any) {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, encoding: Array.from(encoding as Float32Array) }),
  });
  if (!res.ok) throw new Error('Failed to register user');
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function logAccess(userName: string) {
  const res = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName }),
  });
  if (!res.ok) throw new Error('Failed to log access');
  return res.json();
}

export async function fetchLogs() {
  const res = await fetch('/api/logs');
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function deleteUser(id: number) {
  const res = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
}

export async function sendHeartbeat(machineId: string, snapshot: string, lastDetectedUser?: string) {
  const res = await fetch('/api/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ machineId, snapshot, lastDetectedUser }),
  });
  if (!res.ok) throw new Error('Failed to send heartbeat');
  return res.json();
}

export async function fetchStations() {
  const res = await fetch('/api/stations');
  if (!res.ok) throw new Error('Failed to fetch stations');
  return res.json();
}
