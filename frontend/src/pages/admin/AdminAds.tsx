import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Eye, Clock, Loader2, Youtube, Upload, Film, ToggleLeft, ToggleRight, X, Video, AlertCircle, Check } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Badge } from '@/components/admin/AdminComponents';
import { toast } from 'sonner';
import { advertisementApi, type Advertisement } from '@/services/api';
import { getErrorMessage } from '@/lib/error';

type ModalType = 'add' | 'edit' | 'delete' | null;
type VideoType = 'YOUTUBE' | 'LOCAL';

export default function AdminAds() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [videoType, setVideoType] = useState<VideoType>('LOCAL');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    videoUrl: '',
    videoType: 'LOCAL' as VideoType,
    duration: 15,
    displayDuration: 15,
    startTime: 0,
    endTime: 15,
    isActive: false,
    skipable: true,
    skipAfter: 5,
    priority: 1,
    weight: 1,
  });

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    try {
      const response = await advertisementApi.getAll();
      setAds(response.data.data || []);
    } catch (error) {
      toast.error('Gagal memuat iklan');
    } finally {
      setIsLoading(false);
    }
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^?&\s]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format video tidak didukung. Gunakan MP4, WebM, atau OGG');
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 100MB');
      return;
    }

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('video', file);

      const response = await advertisementApi.upload(formDataUpload);
      const { videoUrl, filename } = response.data.data!;

      setUploadedVideoUrl(videoUrl);
      setFormData(prev => ({ ...prev, videoUrl }));
      toast.success(`Video "${filename}" berhasil diupload`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal mengupload video'));
    } finally {
      setIsUploading(false);
    }
  };

  // Detect video duration when video loads
  const handleVideoLoadedMetadata = () => {
    if (videoPreviewRef.current) {
      const duration = Math.floor(videoPreviewRef.current.duration);
      setVideoDuration(duration);
      
      // Auto-set duration and endTime to match video
      setFormData(prev => ({
        ...prev,
        duration: duration,
        endTime: duration,
        displayDuration: duration,
        // Ensure skipAfter doesn't exceed duration
        skipAfter: Math.min(prev.skipAfter, duration - 1),
      }));
    }
  };

  const handleDurationChange = (value: number) => {
    // Can't exceed actual video duration
    const maxDuration = videoDuration > 0 ? videoDuration : 300;
    const newDuration = Math.min(value, maxDuration);
    
    setFormData(prev => ({
      ...prev,
      duration: newDuration,
      endTime: newDuration,
      displayDuration: newDuration,
      skipAfter: Math.min(prev.skipAfter, newDuration - 1),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title) {
      toast.error('Judul iklan harus diisi');
      return;
    }

    if (videoType === 'YOUTUBE') {
      if (!formData.videoUrl) {
        toast.error('URL YouTube harus diisi');
        return;
      }
      const youtubeId = extractYouTubeId(formData.videoUrl);
      if (!youtubeId) {
        toast.error('URL YouTube tidak valid');
        return;
      }
    } else {
      if (!uploadedVideoUrl && !editingAd?.videoUrl) {
        toast.error('Upload video terlebih dahulu');
        return;
      }
    }
    
    setIsSaving(true);
    try {
      const dataToSend = {
        ...formData,
        videoType,
        videoUrl: videoType === 'LOCAL' ? (uploadedVideoUrl || editingAd?.videoUrl) : formData.videoUrl,
        thumbnailUrl: videoType === 'YOUTUBE' ? undefined : null, // No thumbnail for local videos
      };

      if (editingAd) {
        await advertisementApi.update(editingAd.id, dataToSend);
        toast.success('Iklan berhasil diupdate');
      } else {
        await advertisementApi.create(dataToSend);
        toast.success('Iklan berhasil ditambahkan');
      }
      
      await loadAds();
      closeModal();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan iklan'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAd) return;
    
    setIsSaving(true);
    try {
      await advertisementApi.delete(editingAd.id);
      toast.success('Iklan berhasil dihapus');
      await loadAds();
      closeModal();
    } catch (error) {
      toast.error('Gagal menghapus iklan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (ad: Advertisement) => {
    try {
      await advertisementApi.update(ad.id, { isActive: !ad.isActive });
      toast.success(ad.isActive ? 'Iklan dinonaktifkan' : 'Iklan diaktifkan');
      await loadAds();
    } catch (error) {
      toast.error('Gagal mengubah status iklan');
    }
  };

  const openAddModal = () => {
    setEditingAd(null);
    setVideoType('LOCAL');
    setUploadedVideoUrl('');
    setVideoDuration(0);
    setFormData({
      title: '',
      videoUrl: '',
      videoType: 'LOCAL',
      duration: 15,
      displayDuration: 15,
      startTime: 0,
      endTime: 15,
      isActive: false,
      skipable: true,
      skipAfter: 5,
      priority: 1,
      weight: 1,
    });
    setModalType('add');
  };

  const openEditModal = (ad: Advertisement) => {
    setEditingAd(ad);
    const adVideoType = (ad.videoType as VideoType) || 'YOUTUBE';
    setVideoType(adVideoType);
    setUploadedVideoUrl(adVideoType === 'LOCAL' ? ad.videoUrl : '');
    setVideoDuration(ad.duration);
    setFormData({
      title: ad.title,
      videoUrl: ad.videoUrl,
      videoType: adVideoType,
      duration: ad.duration,
      displayDuration: ad.displayDuration,
      startTime: ad.startTime,
      endTime: ad.endTime || ad.duration,
      isActive: ad.isActive,
      skipable: ad.skipable,
      skipAfter: ad.skipAfter,
      priority: ad.priority,
      weight: ad.weight,
    });
    setModalType('edit');
  };

  const openDeleteModal = (ad: Advertisement) => {
    setEditingAd(ad);
    setModalType('delete');
  };

  const closeModal = () => {
    setModalType(null);
    setEditingAd(null);
    setUploadedVideoUrl('');
    setVideoDuration(0);
  };

  const getVideoPreviewUrl = () => {
    if (videoType === 'LOCAL') {
      return uploadedVideoUrl || editingAd?.videoUrl || '';
    }
    return '';
  };

  // Get view counts - use both field names for compatibility
  const getViews = (ad: Advertisement) => ad.views || ad.viewCount || 0;
  const getCompletions = (ad: Advertisement) => ad.completions || ad.completionCount || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      
      <main className="admin-content">
        <AdminHeader title="Manajemen Iklan" subtitle="Kelola iklan video untuk portal WiFi" />
        
        <div className="p-6 space-y-6 animate-fade-in">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Film className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{ads.length}</p>
                  <p className="text-sm text-muted-foreground">Total Iklan</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-xl">
                  <Check className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{ads.filter(a => a.isActive).length}</p>
                  <p className="text-sm text-muted-foreground">Aktif</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info/10 rounded-xl">
                  <Eye className="w-6 h-6 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{ads.reduce((sum, a) => sum + getViews(a), 0)}</p>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-xl">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{ads.reduce((sum, a) => sum + getCompletions(a), 0)}</p>
                  <p className="text-sm text-muted-foreground">Completions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Daftar Iklan</h2>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Tambah Iklan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Preview</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Judul</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tipe</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Durasi</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Skip</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Statistik</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-8 text-muted-foreground">
                        <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Belum ada iklan. Tambah iklan pertama!</p>
                      </td>
                    </tr>
                  ) : (
                    ads.map((ad) => (
                      <tr key={ad.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                        {/* Preview */}
                        <td className="p-3">
                          {ad.videoType === 'YOUTUBE' && ad.youtubeId ? (
                            <img 
                              src={ad.thumbnailUrl || `https://img.youtube.com/vi/${ad.youtubeId}/mqdefault.jpg`} 
                              alt={ad.title} 
                              className="w-20 h-12 object-cover rounded-lg" 
                            />
                          ) : (
                            <div className="w-20 h-12 bg-secondary rounded-lg flex items-center justify-center">
                              <Video className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                        {/* Title */}
                        <td className="p-3">
                          <span className="font-medium">{ad.title}</span>
                        </td>
                        {/* Type */}
                        <td className="p-3">
                          {ad.videoType === 'YOUTUBE' ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <Youtube className="w-3 h-3" />
                              YouTube
                            </Badge>
                          ) : (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <Upload className="w-3 h-3" />
                              Lokal
                            </Badge>
                          )}
                        </td>
                        {/* Duration */}
                        <td className="p-3">
                          <span className="font-mono">{ad.duration}s</span>
                        </td>
                        {/* Skip */}
                        <td className="p-3">
                          {ad.skipable ? (
                            <Badge variant="success">Ya ({ad.skipAfter}s)</Badge>
                          ) : (
                            <Badge variant="warning">Tidak</Badge>
                          )}
                        </td>
                        {/* Stats */}
                        <td className="p-3">
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3 text-muted-foreground" />
                              <span>{getViews(ad)} views</span>
                            </div>
                            <div className="text-muted-foreground text-xs">{getCompletions(ad)} completions</div>
                          </div>
                        </td>
                        {/* Status - Improved UX with toggle */}
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleStatus(ad)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              ad.isActive 
                                ? 'bg-success/10 text-success hover:bg-success/20' 
                                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                            }`}
                          >
                            {ad.isActive ? (
                              <>
                                <ToggleRight className="w-4 h-4" />
                                Aktif
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4" />
                                Nonaktif
                              </>
                            )}
                          </button>
                        </td>
                        {/* Actions */}
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(ad)}
                              className="p-2 hover:bg-secondary rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-primary" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(ad)}
                              className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-elevated">
            <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold">
                {modalType === 'add' ? 'Tambah Iklan Baru' : 'Edit Iklan'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Video Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Tipe Video</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVideoType('LOCAL')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      videoType === 'LOCAL'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Upload className={`w-6 h-6 mx-auto mb-2 ${videoType === 'LOCAL' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className={`font-medium ${videoType === 'LOCAL' ? 'text-primary' : ''}`}>Upload Video</p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, WebM, OGG (maks 100MB)</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoType('YOUTUBE')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      videoType === 'YOUTUBE'
                        ? 'border-red-500 bg-red-500/5'
                        : 'border-border hover:border-red-500/50'
                    }`}
                  >
                    <Youtube className={`w-6 h-6 mx-auto mb-2 ${videoType === 'YOUTUBE' ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <p className={`font-medium ${videoType === 'YOUTUBE' ? 'text-red-500' : ''}`}>YouTube</p>
                    <p className="text-xs text-muted-foreground mt-1">Paste URL YouTube</p>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Judul Iklan *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                  placeholder="Nama iklan untuk identifikasi"
                  required
                />
              </div>

              {/* Video Input based on type */}
              {videoType === 'LOCAL' ? (
                <div>
                  <label className="block text-sm font-medium mb-2">Upload Video *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/ogg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  {/* Upload Area */}
                  {!uploadedVideoUrl && !editingAd?.videoUrl ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full p-8 border-2 border-dashed border-border rounded-xl hover:border-primary transition-colors flex flex-col items-center justify-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <span className="text-sm text-muted-foreground">Mengupload...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Klik untuk upload video</span>
                          <span className="text-xs text-muted-foreground">MP4, WebM, OGG - Maksimal 100MB</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {/* Video Preview */}
                      <div className="relative rounded-xl overflow-hidden bg-black">
                        <video
                          ref={videoPreviewRef}
                          src={getVideoPreviewUrl()}
                          className="w-full h-48 object-contain"
                          controls
                          onLoadedMetadata={handleVideoLoadedMetadata}
                        />
                      </div>
                      
                      {/* Video Info & Actions */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <p className="text-muted-foreground">
                            Durasi video: <span className="font-medium text-foreground">{videoDuration}s</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedVideoUrl('');
                            setVideoDuration(0);
                            fileInputRef.current?.click();
                          }}
                          className="text-sm text-primary hover:underline"
                        >
                          Ganti Video
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">URL YouTube *</label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    className="w-full px-4 py-2.5 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                    placeholder="https://www.youtube.com/watch?v=..."
                    required={videoType === 'YOUTUBE'}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Thumbnail akan otomatis diambil dari YouTube
                  </p>
                  
                  {/* YouTube Preview */}
                  {formData.videoUrl && extractYouTubeId(formData.videoUrl) && (
                    <div className="mt-3 rounded-xl overflow-hidden">
                      <img 
                        src={`https://img.youtube.com/vi/${extractYouTubeId(formData.videoUrl)}/mqdefault.jpg`}
                        alt="YouTube Thumbnail"
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Duration Settings */}
              <div className="p-4 bg-secondary/50 rounded-xl space-y-4">
                <h4 className="font-medium text-sm">Pengaturan Durasi</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Durasi Tampil (detik) *
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => handleDurationChange(parseInt(e.target.value) || 5)}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                      min="5"
                      max={videoDuration > 0 ? videoDuration : 300}
                      required
                    />
                    {videoDuration > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Maks: {videoDuration}s (durasi video)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Skip Setelah (detik)</label>
                    <input
                      type="number"
                      value={formData.skipAfter}
                      onChange={(e) => setFormData({ ...formData, skipAfter: Math.min(parseInt(e.target.value) || 0, formData.duration - 1) })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                      min="0"
                      max={formData.duration - 1}
                      disabled={!formData.skipable}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.skipable}
                    onChange={(e) => setFormData({ ...formData, skipable: e.target.checked })}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Izinkan skip setelah countdown</span>
                </label>
              </div>

              {/* Priority & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Prioritas</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Angka lebih tinggi = prioritas lebih tinggi</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Bobot Rotasi</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                    min="1"
                    max="10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Untuk rotasi acak berbobot</p>
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl cursor-pointer">
                <div>
                  <span className="font-medium">Aktifkan Iklan</span>
                  <p className="text-sm text-muted-foreground">Iklan akan langsung tampil di portal</p>
                </div>
                <div className={`relative w-12 h-7 rounded-full transition-colors ${formData.isActive ? 'bg-primary' : 'bg-border'}`}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modalType === 'add' ? 'Tambah Iklan' : 'Simpan Perubahan'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 bg-secondary rounded-xl hover:bg-secondary/80 transition-colors font-medium"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalType === 'delete' && editingAd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl max-w-md w-full shadow-elevated">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Hapus Iklan?</h3>
                  <p className="text-sm text-muted-foreground">Aksi ini tidak dapat dibatalkan</p>
                </div>
              </div>

              <div className="bg-secondary rounded-xl p-4 mb-4">
                <p className="font-medium">{editingAd.title}</p>
                <p className="text-sm text-muted-foreground">
                  {editingAd.videoType === 'YOUTUBE' ? `YouTube: ${editingAd.youtubeId}` : 'Video Lokal'}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-destructive text-white rounded-xl hover:opacity-90 transition-opacity font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ya, Hapus
                </button>
                <button
                  onClick={closeModal}
                  className="px-6 py-2.5 bg-secondary rounded-xl hover:bg-secondary/80 transition-colors font-medium"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
