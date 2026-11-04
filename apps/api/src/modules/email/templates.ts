/**
 * Email templates. Each returns subject, HTML and plain text from typed data. All
 * data is escaped before it reaches the HTML; links are built here from PUBLIC_WEB_URL
 * plus a same-site path, never taken whole from the caller.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateData {
  'assessment-reset': { firstName: string; requisitionTitle: string; path: string };
}

export type TemplateName = keyof TemplateData;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** An absolute URL for a same-site path; anything else falls back to the site root. */
export function siteUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return /^\/(?!\/)/.test(path) ? `${base}${path}` : `${base}/`;
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f4f4fa;font-family:Segoe UI,Arial,sans-serif;color:#121124;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dcdcea;border-radius:12px;">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #ececf5;font-weight:700;letter-spacing:.14em;">ASTEAI</td></tr>
    <tr><td style="padding:24px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #ececf5;font-size:12px;color:#6b6e8a;">You are receiving this because you have an AsteAI account. This is a service message about your account.</td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#2f6fe8;color:#ffffff;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

type Renderer<T> = (data: T, baseUrl: string) => RenderedEmail;

const TEMPLATES: { [K in TemplateName]: Renderer<TemplateData[K]> } = {
  'assessment-reset': ({ firstName, requisitionTitle, path }, baseUrl) => {
    const url = siteUrl(baseUrl, path);
    const subject = `Your assessment for ${requisitionTitle} has been reset`;
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
    return {
      subject,
      html: layout(subject, [
        `<p>${escapeHtml(greeting)}</p>`,
        `<p>Our support team has reset your role-fit assessment for <b>${escapeHtml(requisitionTitle)}</b>. You can start it again whenever you are ready; it begins from the first question.</p>`,
        button(url, 'Start the assessment'),
        `<p style="font-size:13px;color:#6b6e8a;">If the button doesn't work, copy this link into your browser:<br>${escapeHtml(url)}</p>`,
      ].join('')),
      text: [
        greeting,
        '',
        `Our support team has reset your role-fit assessment for ${requisitionTitle}. You can start it again whenever you are ready; it begins from the first question.`,
        '',
        `Start the assessment: ${url}`,
      ].join('\n'),
    };
  },
};

export function render<K extends TemplateName>(name: K, data: TemplateData[K], baseUrl: string): RenderedEmail {
  return (TEMPLATES[name] as Renderer<TemplateData[K]>)(data, baseUrl);
}
