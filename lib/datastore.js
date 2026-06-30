import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');
const AGENTS_FILE = path.join(process.cwd(), 'agents.json');
const SCHEDULES_FILE = path.join(process.cwd(), 'schedules.json');

const DEFAULT_DATA = {
  projects: [],
  notifications: [],
  dailyTasks: [],
  reminders: [],
  flows: [],
  flowExecutions: [],
};

export function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return DEFAULT_DATA;
  }
}

export function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function readFile(filePath, defaults = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return defaults;
  }
}

export function writeFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function readAgents() {
  return readFile(AGENTS_FILE, []);
}

export function writeAgents(agents) {
  writeFile(AGENTS_FILE, agents);
}

export function readSchedules() {
  return readFile(SCHEDULES_FILE, []);
}

export function writeSchedules(schedules) {
  writeFile(SCHEDULES_FILE, schedules);
}

export const DATA_PATHS = {
  DATA_FILE,
  AGENTS_FILE,
  SCHEDULES_FILE,
};
