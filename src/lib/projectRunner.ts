import {ProjectFileRecord} from '../data/projects';

export function getRunnableFile(files: ProjectFileRecord[]): ProjectFileRecord | undefined {
  return (
    files.find((f) => /^index\.html?$/i.test(f.name) && Boolean(f.previewText)) ||
    files.find((f) => /\.(html?|htm)$/i.test(f.name) && Boolean(f.previewText)) ||
    files.find((f) => /\.svg$/i.test(f.name) && Boolean(f.previewText)) ||
    files.find((f) => /\.js$/i.test(f.name) && Boolean(f.previewText))
  );
}

export function bundleProjectHtml(
  files: ProjectFileRecord[],
  projectTitle = 'Klyro Live App'
): string | null {
  if (!files || files.length === 0) return null;

  const htmlFile =
    files.find((f) => /^index\.html?$/i.test(f.name) && Boolean(f.previewText)) ||
    files.find((f) => /\.(html?|htm)$/i.test(f.name) && Boolean(f.previewText));

  const cssBlocks = files
    .filter((f) => /\.css$/i.test(f.name) && typeof f.previewText === 'string')
    .map((f) => `<style data-klyro-file="${f.name}">\n${f.previewText}\n</style>`)
    .join('\n');

  const jsBlocks = files
    .filter((f) => /\.js$/i.test(f.name) && typeof f.previewText === 'string')
    .map((f) => `<script data-klyro-file="${f.name}">\n${f.previewText}\n</script>`)
    .join('\n');

  const jsonMap: Record<string, unknown> = {};
  for (const f of files) {
    if (/\.json$/i.test(f.name) && typeof f.previewText === 'string') {
      try {
        jsonMap[f.name] = JSON.parse(f.previewText);
      } catch {
        jsonMap[f.name] = f.previewText;
      }
    }
  }
  const dataScript =
    Object.keys(jsonMap).length > 0
      ? `<script>window.__KLYRO_FILES__ = ${JSON.stringify(jsonMap).replace(/</g, '\\u003c')};</script>`
      : '';

  if (htmlFile && htmlFile.previewText) {
    let doc = htmlFile.previewText;
    const headInsert = [cssBlocks, dataScript].filter(Boolean).join('\n');
    if (headInsert) {
      if (/<\/head>/i.test(doc)) {
        doc = doc.replace(/<\/head>/i, `${headInsert}\n</head>`);
      } else {
        doc = `${headInsert}\n${doc}`;
      }
    }
    if (jsBlocks) {
      if (/<\/body>/i.test(doc)) {
        doc = doc.replace(/<\/body>/i, `${jsBlocks}\n</body>`);
      } else {
        doc = `${doc}\n${jsBlocks}`;
      }
    }
    return doc;
  }

  const svgFile = files.find((f) => /\.svg$/i.test(f.name) && typeof f.previewText === 'string');
  if (svgFile?.previewText) {
    return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${projectTitle}</title>
<style>html,body{margin:0;height:100%;background:#09090b;display:flex;align-items:center;justify-content:center;padding:20px;}svg{max-width:100%;max-height:100%;}</style>
</head><body>${svgFile.previewText}</body></html>`;
  }

  if (jsBlocks) {
    return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${projectTitle}</title>
<style>*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;}body{margin:0;background:#09090b;color:#fafafa;padding:24px;}</style>
${cssBlocks}
${dataScript}
</head><body><div id="app"></div>${jsBlocks}</body></html>`;
  }

  return null;
}
