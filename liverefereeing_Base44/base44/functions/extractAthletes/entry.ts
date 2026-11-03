import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyGateToken } from '../../shared/cubeAuth.ts';

export default async function(req) {
  try {
    // ORGACube is protected by its shared password gate (not app-user auth).
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    if (!(await verifyGateToken('orga', String(body?.token || '')))) {
      return Response.json({ error: 'ORGACube session expired. Please unlock again.' }, { status: 401 });
    }
    const fileUrl = body?.fileUrl;
    if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });

    const res = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: 'object',
        properties: {
          athletes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                country: { type: 'string' },
                helmetNumber: { type: 'string' },
                gender: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const out = res?.status === 'error' ? null : res?.output;
    let list = Array.isArray(out) ? out : out?.athletes || [];
    list = list.filter((a: any) => a && a.helmetNumber && (a.lastName || a.firstName));

    // Fallback for grouped layouts (e.g. ISU "List of Competitors": the country is
    // only printed once per group, helmet number in column 2, "LASTNAME Firstname" in column 3).
    if (list.length === 0) {
      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt:
          'This file is a list of competitors (e.g. an ISU "List of Competitors"). Extract EVERY athlete row. ' +
          'Layout: a country group header such as "CRO - Croatia" is printed only on the first row of each group and applies to all following rows until the next country header. ' +
          'Each row has a helmet number (a number, usually in the second column), then the name in the form "LASTNAME Firstname" (last name in capitals, first name after it; ' +
          'prefixes like "van" belong to the last name), then a UPID. ' +
          'Return for each athlete: helmetNumber (digits only), lastName, firstName, country (the 3-letter code of the group, e.g. CRO). ' +
          'Do not skip any athlete and do not invent any.',
        file_urls: [fileUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            athletes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  helmetNumber: { type: 'string' },
                  lastName: { type: 'string' },
                  firstName: { type: 'string' },
                  country: { type: 'string' },
                },
              },
            },
          },
        },
      });
      list = llm?.athletes || [];
    }

    // ISU lists print the country as "CRO - Croatia" on the group header. Keep only
    // the three-letter code the rest of the app expects; a plain country name is
    // left alone, the flag lookup resolves it by name.
    const normalizeCountry = (value: any) => {
      const s = String(value || '').trim();
      const m = s.match(/^([A-Za-z]{3})\s*[-\u2013\u2014/]\s*\S/);
      return (m ? m[1] : s).toUpperCase();
    };
    list = list.map((a: any) => ({ ...a, country: normalizeCountry(a.country) }));

    return Response.json({ athletes: list });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}