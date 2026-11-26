import {ProjectFileRecord} from '../data/projects';

export async function uploadProjectFile(
  file: File,
  projectId: string,
  ownerUid: string
): Promise<ProjectFileRecord> {
  if (file.size > 5_242_880) {
    throw new Error(`${file.name} exceeds the 5MB per-file limit.`);
  }

  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read file.'));
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || inferMimeFromName(file.name);

  const res = await fetch('/api/files/upload', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      name: file.name,
      mimeType,
      dataBase64,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Could not upload ${file.name}.`);
  }

  return {
    ...data.file,
    projectId,
    ownerUid,
  };
}

function inferMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'text/typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'text/javascript';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.zip')) return 'application/zip';
  return 'text/plain';
}
