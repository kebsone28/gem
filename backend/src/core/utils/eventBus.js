import EventEmitter from 'events';

const eventBus = new EventEmitter();

// Increase max listeners to avoid warnings in dev with many subscribers
eventBus.setMaxListeners(100);

export default eventBus;
