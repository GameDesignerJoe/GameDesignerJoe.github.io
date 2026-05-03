// Central registry — server's recommend.js dispatches by `provider` field
// using this map. Order also drives the Settings dropdown.
import { anthropic } from './anthropic.js';
import { openai } from './openai.js';
import { google } from './google.js';
import { xai } from './xai.js';

export const PROVIDERS = { anthropic, openai, google, xai };

export const PROVIDER_ORDER = ['anthropic', 'openai', 'google', 'xai'];
