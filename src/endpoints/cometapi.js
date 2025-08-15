import express from 'express';
import fetch from 'node-fetch';

export const router = express.Router();
const API_COMETAPI = 'https://api.cometapi.com/v1';

router.get('/models', async (req, res) => {
    try {
        const apiKey = req.headers['authorization']?.replace('Bearer ', '');
        console.log('DEBUG: CometAPI API key received (FULL KEY FOR DEBUGGING):', apiKey);
        console.log('DEBUG: API key length:', apiKey ? apiKey.length : 0);

        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' });
        }

        const response = await fetch(`${API_COMETAPI}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.log(`CometAPI models request failed with status: ${response.status}`);
            const errorText = await response.text();
            console.log(`CometAPI error response: ${errorText}`);
            return res.json([]);
        }

        /** @type {any} */
        const data = await response.json();
        console.log('CometAPI raw response:', JSON.stringify(data, null, 2));

        // Handle different possible response structures
        const models = data?.data || data?.models || data || [];
        console.log(`Found ${models.length} total models before filtering`);

        if (!Array.isArray(models)) {
            console.log('Models is not an array:', typeof models);
            return res.json([]);
        }

        // Filter out non-chat models
        const filteredModels = models.filter(model => {
            const modelId = model.id.toLowerCase();

            // Filter out image generation models (but keep vision/multimodal chat models)
            const imageGenPatterns = [
                'dall-e',
                'dalle',
                'midjourney',
                'mj_',  // All Midjourney models
                'stable-diffusion',
                'sd-',
                'flux-',
                'playground-v',
                'ideogram',
                'recraft-',
                'black-forest-labs',
                '/recraft-v3',
                'recraftv3',
                'stability-ai/',
                'sdxl',  // Stable Diffusion XL
            ];

            // Filter out video generation models
            const videoGenPatterns = [
                'runway',
                'luma_',
                'luma-',
                'veo',
                'kling_',
                'minimax_video',
                'hunyuan-t1',  // Hunyuan video models
            ];

            // Filter out audio/music generation models
            const audioGenPatterns = [
                'suno_',
                'tts',
                'whisper',
            ];

            // Filter out embedding and other utility models
            const utilityPatterns = [
                'embedding',
                'search-gpts',
                'files_retrieve',
                'moderation',
            ];

            // Check if model matches any excluded pattern
            const isImageModel = imageGenPatterns.some(pattern => modelId.includes(pattern));
            const isVideoModel = videoGenPatterns.some(pattern => modelId.includes(pattern));
            const isAudioModel = audioGenPatterns.some(pattern => modelId.includes(pattern));
            const isUtilityModel = utilityPatterns.some(pattern => modelId.includes(pattern));

            // Return true only if it's a chat model (not filtered out)
            return !isImageModel && !isVideoModel && !isAudioModel && !isUtilityModel;
        });

        console.log(`Filtered models: ${filteredModels.length} remaining after filtering`);
        console.log('Filtered model IDs:', filteredModels.map(m => m.id));

        return res.json(filteredModels);
    } catch (error) {
        console.error('Error fetching CometAPI models:', error);
        return res.sendStatus(500);
    }
});
