const NOTION_DATABASE_ID = '33291a1ce62c80058b07fd4620c66cf7';
const ALLOWED_ORIGIN = 'https://aetherspace.tech';
const R2_PUBLIC_URL = 'https://pub-b7bfea70a1064caa9c9b12dbd905cabd.r2.dev';

function corsHeaders(origin) {
    const allowed = origin === ALLOWED_ORIGIN || origin === 'https://www.aetherspace.tech';
    return {
        'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        const contentType = request.headers.get('Content-Type') || '';
        let body = {};
        let cvUrl = null;

        if (contentType.includes('multipart/form-data')) {
            let formData;
            try {
                formData = await request.formData();
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid form data' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
                });
            }

            body = {
                name: formData.get('name') || '',
                email: formData.get('email') || '',
                company: formData.get('company') || '',
                message: formData.get('message') || '',
                page: formData.get('page') || '',
                submittedAt: formData.get('submittedAt') || new Date().toISOString(),
                company_honeypot: formData.get('company_honeypot') || '',
            };

            const cvFile = formData.get('cv');
            if (cvFile && cvFile.size > 0) {
                const safeName = cvFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const key = `cvs/${Date.now()}-${safeName}`;
                await env.CV_BUCKET.put(key, cvFile.stream(), {
                    httpMetadata: { contentType: cvFile.type },
                });
                cvUrl = `${R2_PUBLIC_URL}/${key}`;
            }
        } else {
            try {
                body = await request.json();
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
                });
            }
        }

        const { name, email, company, message, page, submittedAt } = body;

        // Basic server-side validation
        if (!name || !email || !message) {
            return new Response(JSON.stringify({ error: 'Name, email, and message are required.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        // Honeypot check
        if (body.company_honeypot) {
            return new Response(JSON.stringify({ message: 'Message sent. We will be in touch soon.' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        const fullMessage = cvUrl ? `CV: ${cvUrl}\n\n${message}` : message;

        const notionPayload = {
            parent: { database_id: NOTION_DATABASE_ID },
            properties: {
                Name: {
                    title: [{ text: { content: name } }],
                },
                Email: {
                    email: email,
                },
                Company: {
                    rich_text: [{ text: { content: company || '' } }],
                },
                Message: {
                    rich_text: [{ text: { content: fullMessage.slice(0, 2000) } }],
                },
                Page: {
                    rich_text: [{ text: { content: page || '' } }],
                },
                'Submitted At': {
                    date: { start: submittedAt || new Date().toISOString() },
                },
                Status: {
                    select: { name: 'New' },
                },
            },
        };

        const notionRes = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.NOTION_TOKEN}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify(notionPayload),
        });

        if (!notionRes.ok) {
            const err = await notionRes.text();
            console.error('Notion error:', err);
            return new Response(JSON.stringify({ error: 'Could not save your message. Please try again.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        return new Response(JSON.stringify({ message: 'Message sent. We will be in touch soon.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
    },
};
