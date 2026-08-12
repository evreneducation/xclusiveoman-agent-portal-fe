import { api } from '../api/client.js';
import { ImageUpload } from './ImageUpload.jsx';

// Shared by the Product Catalog Tour form (TourEditor.jsx) and the Admin
// MICE Catalog Tour form (MiceCatalog.jsx) — both create/edit rows in the
// same `tours` table, so they upload through the same endpoint and render
// the same picker rather than each keeping their own copy.
export function TourImagesUpload({ tourId, images, onChange }) {
  async function upload(files) {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    if (tourId) formData.append('tourId', tourId);
    const { images: uploaded } = await api.postForm('/admin/tours/images', formData);
    return [...images, ...uploaded];
  }

  return (
    <ImageUpload
      label="Images"
      required
      multiple
      value={images}
      onChange={onChange}
      onUpload={upload}
      hint={images.length === 0 ? 'Upload at least one image. The first image is used as the primary listing photo.' : undefined}
    />
  );
}
