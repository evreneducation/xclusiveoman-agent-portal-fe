import { useState } from 'react';
import { api } from '../api/client.js';
import { ErrorText, FieldLabel } from './ui.jsx';

// Mirrors HotelImagesUpload.jsx / TourImagesUpload.jsx — same picker, same
// upload flow, scoped to the `transfers` table's own images endpoint.
export function TransferImagesUpload({ transferId, images, onChange }) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file later
    if (files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('images', file));
      if (transferId) formData.append('transferId', transferId);
      const { images: uploaded } = await api.postForm('/admin/transfers/images', formData);
      onChange([...images, ...uploaded]);
    } catch (err) {
      setError(err.message || 'Unable to upload images');
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(url) {
    onChange(images.filter((u) => u !== url));
  }

  return (
    <div className="sm:col-span-2">
      <FieldLabel>Images</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {images.map((url) => (
          <div key={url} className="group relative h-20 w-20 flex-none">
            <img src={url} alt="" className="h-20 w-20 rounded-md border border-line-light object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(url)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-ink bg-white text-[10px] font-bold text-ink shadow-sm hover:bg-panel"
              title="Remove image"
            >
              ×
            </button>
            {url === images[0] && (
              <span className="absolute bottom-0 left-0 right-0 rounded-b-md bg-ink/80 py-0.5 text-center text-[8px] font-semibold uppercase text-white">
                Primary
              </span>
            )}
          </div>
        ))}
        <label className="flex h-20 w-20 flex-none cursor-pointer items-center justify-center rounded-md border border-dashed border-line-light text-center font-mono text-[9px] leading-tight text-muted hover:border-ink hover:text-ink">
          {uploading ? 'Uploading…' : '+ Add images'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={handleFiles}
          />
        </label>
      </div>
      {images.length === 0 && <p className="mt-1 text-[10px] text-muted">The first image is used as the primary listing photo.</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
