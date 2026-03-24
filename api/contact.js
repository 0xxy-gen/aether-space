const NOTION_VERSION = '2022-06-28';
const REQUIRED_FIELDS = ['name', 'email', 'message', 'page', 'submittedAt'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(payload));
}

function normalizeBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (error) {
            return {};
        }
    }
    return body;
}

function toRichText(content) {
    return [{ type: 'text', text: { content } }];
}

function findProperty(properties, propertyName) {
    return properties[propertyName] || null;
}

async function notionRequest(path, token, options = {}) {
    const response = await fetch(`https://api.notion.com${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION,
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.message || 'Notion request failed');
        error.status = response.status;
        throw error;
    }

    return data;
}

function buildNotionProperties(schema, submission) {
    const nameProperty = findProperty(schema, 'Name');
    const emailProperty = findProperty(schema, 'Email');
    const messageProperty = findProperty(schema, 'Message');
    const sourcePageProperty = findProperty(schema, 'Source Page');
    const submittedAtProperty = findProperty(schema, 'Submitted At');
    const statusProperty = findProperty(schema, 'Status');

    const requiredChecks = [
        ['Name', nameProperty, 'title'],
        ['Email', emailProperty, 'email'],
        ['Message', messageProperty, 'rich_text'],
        ['Source Page', sourcePageProperty, ['rich_text', 'select']],
        ['Submitted At', submittedAtProperty, 'date']
    ];

    for (const [label, property, expectedType] of requiredChecks) {
        if (!property) {
            throw new Error(`Notion database is missing the "${label}" property.`);
        }

        if (Array.isArray(expectedType) ? !expectedType.includes(property.type) : property.type !== expectedType) {
            throw new Error(`Notion property "${label}" must be ${Array.isArray(expectedType) ? expectedType.join(' or ') : expectedType}.`);
        }
    }

    const properties = {
        Name: {
            title: toRichText(submission.name)
        },
        Email: {
            email: submission.email
        },
        Message: {
            rich_text: toRichText(submission.message)
        },
        'Submitted At': {
            date: {
                start: submission.submittedAt
            }
        }
    };

    if (sourcePageProperty.type === 'rich_text') {
        properties['Source Page'] = {
            rich_text: toRichText(submission.page)
        };
    } else {
        properties['Source Page'] = {
            select: {
                name: submission.page
            }
        };
    }

    if (statusProperty && statusProperty.type === 'select') {
        const hasNewOption = (statusProperty.select.options || []).some((option) => option.name === 'New');
        if (hasNewOption) {
            properties.Status = {
                select: {
                    name: 'New'
                }
            };
        }
    }

    return properties;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    const notionToken = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!notionToken || !databaseId) {
        return json(res, 500, { error: 'Server is missing Notion configuration.' });
    }

    const body = normalizeBody(req.body);
    const submission = {
        name: typeof body.name === 'string' ? body.name.trim() : '',
        email: typeof body.email === 'string' ? body.email.trim() : '',
        company: typeof body.company === 'string' ? body.company.trim() : '',
        message: typeof body.message === 'string' ? body.message.trim() : '',
        page: typeof body.page === 'string' ? body.page.trim() : '',
        submittedAt: typeof body.submittedAt === 'string' ? body.submittedAt.trim() : ''
    };

    const missingField = REQUIRED_FIELDS.find((field) => !submission[field]);
    if (missingField) {
        return json(res, 400, { error: 'Please complete all required fields.' });
    }

    if (!EMAIL_PATTERN.test(submission.email)) {
        return json(res, 400, { error: 'Please enter a valid email address.' });
    }

    if (submission.company) {
        return json(res, 400, { error: 'Spam check failed.' });
    }

    if (Number.isNaN(Date.parse(submission.submittedAt))) {
        return json(res, 400, { error: 'Invalid submission timestamp.' });
    }

    try {
        const database = await notionRequest(`/v1/databases/${databaseId}`, notionToken, {
            method: 'GET'
        });

        const properties = buildNotionProperties(database.properties || {}, submission);

        await notionRequest('/v1/pages', notionToken, {
            method: 'POST',
            body: JSON.stringify({
                parent: { database_id: databaseId },
                properties
            })
        });

        return json(res, 200, { message: 'Message sent. We will be in touch soon.' });
    } catch (error) {
        console.error('Contact submission failed:', error.message);
        return json(res, 500, { error: 'We could not save your message right now.' });
    }
};
