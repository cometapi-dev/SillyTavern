import { saveSettingsDebounced } from '../script.js';
import { secret_state, writeSecret } from './secrets.js';
import { oai_settings } from './openai.js';

// Secret keys
const SECRET_KEYS = {
    COMETAPI: 'api_key_cometapi',
};

// Get request headers (copied from openai.js pattern)
function getRequestHeaders() {
    return {
        'Content-Type': 'application/json',
    };
}

// Load settings - simplified like other APIs
// export function loadCometAPISettings() {
//     // console.log('DEBUG: loadCometAPISettings called - Using standard pattern like other APIs');
//     // No special loading needed - using secret_state and oai_settings like others
// }



// Initialize CometAPI module
export function initCometAPI() {

    // Bind event handlers - simplified like other APIs
    $('#cometapi_api_key').on('input', async function() {
        const apiKey = String($(this).val() || '');
        // console.log('DEBUG: CometAPI API key input changed, length:', apiKey.length);
        // console.log('DEBUG: CometAPI API key value:', apiKey);
        if (apiKey) {
            await writeSecret(SECRET_KEYS.COMETAPI, apiKey);
            // console.log('DEBUG: CometAPI API key written to secret_state');

            // Verify what was written
            if (secret_state[SECRET_KEYS.COMETAPI] && Array.isArray(secret_state[SECRET_KEYS.COMETAPI]) && secret_state[SECRET_KEYS.COMETAPI].length > 0) {
                const verifyKey = String(secret_state[SECRET_KEYS.COMETAPI][0].value || '');
                // console.log('DEBUG: Verified API key in secret_state, length:', verifyKey.length);
                // console.log('DEBUG: Verified API key value:', verifyKey);
            }
        }
        // console.log('DEBUG: CometAPI API key updated in secret_state');
    });

    $('#cometapi_model').on('change', function() {
        oai_settings.cometapi_model = String($(this).val() || '');
        saveSettingsDebounced();
        // console.log('DEBUG: CometAPI model updated:', oai_settings.cometapi_model);
    });

    $('#cometapi_refresh_models').on('click', refreshCometAPIModels);

    // Load models if API key is present in secret_state
    if (secret_state[SECRET_KEYS.COMETAPI]) {
        refreshCometAPIModels();
    }
}

// Refresh available models list
async function refreshCometAPIModels() {
    // Get the API key directly from the input box, do not get it from secret_state because it has been truncated there.
    const apiKey = String($('#cometapi_api_key').val() || '').trim();

    console.log('DEBUG: CometAPI refresh - API key from input field, length:', apiKey.length);
    console.log('DEBUG: CometAPI refresh - API key value:', apiKey);

    if (!apiKey) {
        // toastr.error('Please enter your CometAPI key first');
        return;
    }

    const refreshButton = $('#cometapi_refresh_models');
    const originalHtml = refreshButton.html();

    try {
        // Show loading state
        refreshButton.html('<i class="fa-solid fa-spinner fa-spin"></i> Loading...');
        refreshButton.prop('disabled', true);

        console.log('DEBUG: Frontend - About to send request with API key length:', apiKey.length);

        const response = await fetch('/api/cometapi/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...getRequestHeaders(),
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const modelSelect = $('#cometapi_model');
        const currentModel = modelSelect.val();

        modelSelect.empty();
        modelSelect.append('<option value="">Select Model</option>');

        if (data.data && Array.isArray(data.data)) {
            // Sort models alphabetically
            const sortedModels = data.data.sort((a, b) => a.id.localeCompare(b.id));

            sortedModels.forEach(model => {
                const option = $('<option></option>')
                    .attr('value', model.id)
                    .text(model.id);
                modelSelect.append(option);
            });

            // Restore previously selected model if it still exists
            if (currentModel && data.data.find(m => m.id === currentModel)) {
                modelSelect.val(currentModel);
            } else if (oai_settings.cometapi_model && data.data.find(m => m.id === oai_settings.cometapi_model)) {
                modelSelect.val(oai_settings.cometapi_model);
            }
        }

        toastr.success(`Loaded ${data.data?.length || 0} CometAPI models`);
    } catch (error) {
        console.error('Error fetching CometAPI models:', error);
        toastr.error(`Failed to fetch models: ${error.message}`);
    } finally {
        // Restore button state
        refreshButton.html(originalHtml);
        refreshButton.prop('disabled', false);
    }
}

// Send chat completion request
export async function sendCometAPIChatCompletion(messages, settings, signal) {
    // Get API key from secret_state like other APIs
    let apiKey = '';

    if (secret_state[SECRET_KEYS.COMETAPI] && Array.isArray(secret_state[SECRET_KEYS.COMETAPI]) && secret_state[SECRET_KEYS.COMETAPI].length > 0) {
        const firstSecret = secret_state[SECRET_KEYS.COMETAPI][0];
        apiKey = String(firstSecret.value || '').replace(/^Bearer\s+/i, '');
    }

    if (!apiKey) {
        throw new Error('CometAPI key not configured');
    }

    if (!oai_settings.cometapi_model) {
        throw new Error('No CometAPI model selected');
    }

    const requestBody = {
        model: oai_settings.cometapi_model,
        messages: messages,
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
        top_p: settings.top_p,
        frequency_penalty: settings.frequency_penalty,
        presence_penalty: settings.presence_penalty,
        stream: settings.stream || false,
    };

    // Remove undefined values
    Object.keys(requestBody).forEach(key => {
        if (requestBody[key] === undefined) {
            delete requestBody[key];
        }
    });

    const response = await fetch('/api/cometapi/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...getRequestHeaders(),
        },
        body: JSON.stringify(requestBody),
        signal: signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'CometAPI request failed';
        try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error?.message || errorData.error || errorMessage;
        } catch {
            errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
    }

    return response;
}

// Get current model name for display
export function getCometAPIModelName() {
    return oai_settings.cometapi_model || 'No model selected';
}

// Check if CometAPI is properly configured
export function isCometAPIConfigured() {
    const hasApiKey = !!(secret_state[SECRET_KEYS.COMETAPI] && Array.isArray(secret_state[SECRET_KEYS.COMETAPI]) && secret_state[SECRET_KEYS.COMETAPI].length > 0);
    const hasModel = !!oai_settings.cometapi_model;
    return hasApiKey && hasModel;
}
