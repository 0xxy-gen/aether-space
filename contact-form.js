const CONTACT_API_ENDPOINT = '/api/contact';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setStatusMessage(element, message, tone) {
    if (!element) return;

    element.textContent = message || '';
    element.classList.remove('text-white/45', 'text-red-300/90', 'text-cyan-300');

    if (tone === 'error') {
        element.classList.add('text-red-300/90');
        return;
    }

    if (tone === 'success') {
        element.classList.add('text-cyan-300');
        return;
    }

    element.classList.add('text-white/45');
}

function setFieldError(field, errorElement, message) {
    if (field) {
        field.classList.toggle('contact-error', Boolean(message));
        field.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    if (errorElement) {
        errorElement.textContent = message || '';
    }
}

function validateForm(values, fieldMap, errorMap) {
    let hasErrors = false;

    if (!values.name) {
        setFieldError(fieldMap.name, errorMap.name, 'Please enter your name.');
        hasErrors = true;
    } else {
        setFieldError(fieldMap.name, errorMap.name, '');
    }

    if (!values.email) {
        setFieldError(fieldMap.email, errorMap.email, 'Please enter your email.');
        hasErrors = true;
    } else if (!EMAIL_PATTERN.test(values.email)) {
        setFieldError(fieldMap.email, errorMap.email, 'Please enter a valid email address.');
        hasErrors = true;
    } else {
        setFieldError(fieldMap.email, errorMap.email, '');
    }

    if (!values.message) {
        setFieldError(fieldMap.message, errorMap.message, 'Please share a few details.');
        hasErrors = true;
    } else {
        setFieldError(fieldMap.message, errorMap.message, '');
    }

    return !hasErrors;
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('[data-contact-form]');
    if (!form) return;

    const fields = {
        name: form.querySelector('[name="name"]'),
        email: form.querySelector('[name="email"]'),
        company: form.querySelector('[name="company"]'),
        message: form.querySelector('[name="message"]')
    };

    const errors = {
        name: form.querySelector('[data-error-for="name"]'),
        email: form.querySelector('[data-error-for="email"]'),
        message: form.querySelector('[data-error-for="message"]')
    };

    const status = form.querySelector('[data-form-status]');
    const submitButton = form.querySelector('[data-submit-button]');
    const defaultButtonLabel = submitButton ? submitButton.dataset.submitLabel || submitButton.textContent : 'Submit';
    let isSubmitting = false;

    Object.keys(errors).forEach((key) => {
        const field = fields[key];
        if (!field) return;

        field.addEventListener('input', () => {
            if (field.classList.contains('contact-error')) {
                setFieldError(field, errors[key], '');
            }
            if (status && status.textContent) {
                setStatusMessage(status, '', 'default');
            }
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        const values = {
            name: fields.name.value.trim(),
            email: fields.email.value.trim(),
            company: fields.company.value.trim(),
            message: fields.message.value.trim()
        };

        setStatusMessage(status, '', 'default');

        if (!validateForm(values, fields, errors)) {
            setStatusMessage(status, 'Please fix the highlighted fields and try again.', 'error');
            return;
        }

        isSubmitting = true;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
        }
        setStatusMessage(status, 'Sending your message...', 'default');

        try {
            const response = await fetch(CONTACT_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: values.name,
                    email: values.email,
                    company: values.company,
                    message: values.message,
                    page: form.dataset.page || window.location.pathname,
                    submittedAt: new Date().toISOString()
                })
            });

            let payload = {};
            try {
                payload = await response.json();
            } catch (error) {
                payload = {};
            }

            if (!response.ok) {
                const message = response.status === 400
                    ? payload.error || 'Please review your details and try again.'
                    : 'We could not send your message right now. Please try again in a moment.';
                throw new Error(message);
            }

            form.reset();
            Object.keys(errors).forEach((key) => setFieldError(fields[key], errors[key], ''));
            setStatusMessage(status, payload.message || 'Message sent. We will be in touch soon.', 'success');
        } catch (error) {
            setStatusMessage(status, error.message || 'Something went wrong. Please try again.', 'error');
        } finally {
            isSubmitting = false;
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = defaultButtonLabel;
            }
        }
    });
});
