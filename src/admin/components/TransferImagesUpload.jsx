import { api } from '../api/client.js';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';

// Mirrors HotelImagesUpload.jsx / TourImagesUpload.jsx — same picker, same
// upload flow, scoped to the `transfers` table's own images endpoint.
export function TransferImagesUpload({ transferId, images, onChange }) {
  async function upload(files) {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    if (transferId) formData.append('transferId', transferId);
    const { images: uploaded } = await api.postForm('/admin/transfers/images', formData);
    return [...images, ...uploaded];
  }

  return (
    <ImageUpload
      label="Images"
      multiple
      value={images}
      onChange={onChange}
      onUpload={upload}
      hint={images.length === 0 ? 'The first image is used as the primary listing photo.' : undefined}
    />
  );
}
