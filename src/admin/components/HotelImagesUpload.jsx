import { api } from '../api/client.js';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';

// Shared by the Product Catalog Hotel form (HotelEditor.jsx) and the Admin
// MICE Catalog Hotel form (MiceCatalog.jsx) — both create/edit rows in the
// same `hotels` table, so they upload through the same endpoint and render
// the same picker rather than each keeping their own copy.
export function HotelImagesUpload({ hotelId, images, onChange }) {
  async function upload(files) {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    if (hotelId) formData.append('hotelId', hotelId);
    const { images: uploaded } = await api.postForm('/admin/hotels/images', formData);
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
