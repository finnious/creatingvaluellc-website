export async function onRequestPost(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const data = await request.json();

        // Validate required fields
        if (!data.first_name || !data.email) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing required fields' }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Build GHL v2 API request body
        const ghlBody = {
            locationId: env.GHL_LOCATION_ID,
            firstName: data.first_name,
            lastName: data.last_name || '',
            email: data.email,
            tags: data.tags || [],
            source: data.source || 'Website'
        };

        // Only include phone if provided
        // (prevents blanking existing phone on upsert)
        if (data.phone && data.phone.trim() !== '') {
            ghlBody.phone = data.phone.trim();
        }

        // Map custom fields using GHL field IDs
        if (data.customFields && data.customFields.length > 0) {
            ghlBody.customFields = data.customFields.map(field => ({
                id: field.id,
                field_value: field.field_value || ''
            }));
        }

        // GHL v2 API — upsert endpoint
        // Creates new contact OR updates existing (matched by email/phone)
        const ghlResponse = await fetch(
            'https://services.leadconnectorhq.com/contacts/upsert',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.GHL_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28'
                },
                body: JSON.stringify(ghlBody)
            }
        );

        if (!ghlResponse.ok) {
            const error = await ghlResponse.text();
            console.error('GHL Error:', error);
            return new Response(
                JSON.stringify({ success: false, error: 'CRM submission failed' }),
                { status: 500, headers: corsHeaders }
            );
        }

        const result = await ghlResponse.json();

        return new Response(
            JSON.stringify({
                success: true,
                contactId: result.contact?.id,
                new: result.new || false
            }),
            { status: 200, headers: corsHeaders }
        );

    } catch (error) {
        console.error('Function error:', error);
        return new Response(
            JSON.stringify({ success: false, error: 'Server error' }),
            { status: 500, headers: corsHeaders }
        );
    }
}

// Handle OPTIONS preflight requests
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
