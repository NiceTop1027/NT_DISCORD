import React, { useState, useEffect } from 'react';
import ImageCropperModal from '../common/ImageCropperModal'; // Import ImageCropperModal

export default function ServerOverviewPanel({ server, isAdmin, onDeleteServer, onUpdateServer }) {
  const [serverName, setServerName] = useState(server.name);
  const [serverIconUrl, setServerIconUrl] = useState(server.iconUrl || '');
  const [serverBannerUrl, setServerBannerUrl] = useState(server.bannerUrl || ''); // New state for banner
  const [newIconFile, setNewIconFile] = useState(null);
  const [newBannerFile, setNewBannerFile] = useState(null); // New state for banner file
  const [loading, setLoading] = useState(false);

  const handleCropComplete = (croppedImageBlob) => {
    if (isBannerCropper) {
      setNewBannerFile(croppedImageBlob);
      setServerBannerUrl(URL.createObjectURL(croppedImageBlob));
    } else {
      setNewIconFile(croppedImageBlob);
      setServerIconUrl(URL.createObjectURL(croppedImageBlob));
    }
    setIsCropperOpen(false);
    setImageToCrop(null);
  };

  const [isCropperOpen, setIsCropperOpen] = useState(false); // Cropper modal state
  const [imageToCrop, setImageToCrop] = useState(null); // Image URL for cropper
  const [cropAspectRatio, setCropAspectRatio] = useState(1/1); // Aspect ratio for cropper
  const [isBannerCropper, setIsBannerCropper] = useState(false); // Flag to know if cropping banner or icon

  useEffect(() => {
    setServerName(server.name);
    setServerIconUrl(server.iconUrl || '');
    setNewIconFile(null);
  }, [server]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onUpdateServer({
        name: serverName,
        iconUrl: serverIconUrl, // Pass the current displayed icon URL
        newIconFile: newIconFile,
        newBannerFile: newBannerFile, // Pass the new banner file
      });
    } catch (error) {
      console.error("Error updating server overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleIconFileChange = (e) => {
    if (e.target.files[0]) {
      setImageToCrop(URL.createObjectURL(e.target.files[0]));
      setCropAspectRatio(1/1); // Icons are square
      setIsBannerCropper(false);
      setIsCropperOpen(true);
    } else {
      setNewIconFile(null);
      setServerIconUrl(server.iconUrl || '');
    }
  };

  const handleBannerFileChange = (e) => { // New function for banner
    if (e.target.files[0]) {
      setImageToCrop(URL.createObjectURL(e.target.files[0]));
      setCropAspectRatio(16/9); // Banners are wider
      setIsBannerCropper(true);
      setIsCropperOpen(true);
    } else {
      setNewBannerFile(null);
      setServerBannerUrl(server.bannerUrl || '');
    }
  };

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-6">서버 개요</h3>
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-discord-gray-2 uppercase mb-2">Server Icon</label>
          <div className="flex items-center space-x-4">
            {serverIconUrl && (
              <img src={serverIconUrl} alt="Server Icon" className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
            )}
            <div className="flex flex-col space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleIconFileChange}
                className="block w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-discord-blurple file:text-white hover:file:bg-discord-blurple/80 cursor-pointer"
              />
              {serverIconUrl && (
                <button
                  onClick={() => { setServerIconUrl(''); setNewIconFile(null); }}
                  className="text-sm text-red-400 hover:text-red-500 text-left"
                >
                  Remove Icon
                </button>
              )}
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="server-name-input" className="block text-xs font-bold text-discord-gray-2 uppercase mb-2">Server Name</label>
          <input
            id="server-name-input"
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="w-full bg-discord-dark-4 border border-discord-dark-5 rounded px-3 py-2 text-white placeholder-discord-gray-3 focus:outline-none focus:border-discord-blurple"
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button onClick={handleSave} disabled={loading} className="bg-discord-blurple hover:bg-discord-blurple/80 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      {isAdmin && (
        <div className="mt-8 pt-4 border-t border-discord-dark-5">
          <h3 className="text-xs font-bold uppercase text-red-500 mb-4">Danger Zone</h3>
          <button onClick={onDeleteServer} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200">
            Delete Server
          </button>
        </div>
      )}

      {isCropperOpen && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={cropAspectRatio}
        />
      )}
    </div>
  );
}
