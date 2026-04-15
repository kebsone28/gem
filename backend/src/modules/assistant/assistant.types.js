/**
 * @typedef {'greeting'|'help_request'|'technical_issue'|'emotion_support'|'productivity'|'casual_chat'} IntentType
 * @typedef {'neutral'|'happy'|'stressed'|'frustrated'|'confused'|'angry'|'tired'} EmotionType
 *
 * @typedef {Object} AIQueryPayload
 * @property {string} userId
 * @property {string} message
 * @property {Object<string, any>} [context]
 * @property {Object<string, any>} [location]
 * @property {boolean} [offlineMode]
 *
 * @typedef {Object} AssistantMemoryPayload
 * @property {Object<string, any>} [preferences]
 * @property {Array<any>} [history]
 * @property {Array<string>} [frequentTopics]
 * @property {Array<any>} [lastInteractions]
 * @property {string} [technicalLevel]
 */

export {};
