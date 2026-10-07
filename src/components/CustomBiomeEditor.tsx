import React, { useState } from 'react';
import type { CustomBiome } from '../types/map';
import { Plus, Trash2, Edit2, Check, X, Palette, ShieldAlert } from 'lucide-react';

interface CustomBiomeEditorProps {
  biomes: CustomBiome[];
  onUpdateBiomes: (biomes: CustomBiome[]) => void;
  onClose: () => void;
}

export const CustomBiomeEditor: React.FC<CustomBiomeEditorProps> = ({ biomes, onUpdateBiomes, onClose }) => {
  const [biomeList, setBiomeList] = useState<CustomBiome[]>(biomes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomBiome | null>(null);

  const handleEdit = (biome: CustomBiome) => {
    setEditingId(biome.id);
    setFormData({ ...biome });
  };

  const handleSave = () => {
    if (!formData) return;
    setBiomeList((prev) => prev.map((b) => (b.id === formData.id ? formData : b)));
    setEditingId(null);
    setFormData(null);
  };

  const handleAdd = () => {
    const newBiome: CustomBiome = {
      id: `biome_${Date.now()}`,
      name: 'Yeni Özel Biyom',
      color: '#a855f7',
      movementCost: 1,
      minElevation: 0.3,
      maxElevation: 0.7,
      minTemperature: 0.3,
      maxTemperature: 0.7,
      minHumidity: 0.3,
      maxHumidity: 0.7,
      iconName: 'Sparkles',
    };
    setBiomeList([...biomeList, newBiome]);
    handleEdit(newBiome);
  };

  const handleDelete = (id: string) => {
    setBiomeList(biomeList.filter((b) => b.id !== id));
  };

  const handleApplyAll = () => {
    onUpdateBiomes(biomeList);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
            <Palette className="w-5 h-5" />
            <span>Özel Biyom ve Koşul Düzenleyici</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">
              Dünya üretimi esnasında Yükseklik, Sıcaklık ve Nem değerlerine göre spavn olacak biyomları ve renk/hareket maliyetlerini özelleştirin.
            </p>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" /> Biyom Ekle
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {biomeList.map((biome) => {
              const isEditing = editingId === biome.id;

              return (
                <div
                  key={biome.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col gap-4"
                >
                  {isEditing && formData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Biyom Adı</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Renk</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={formData.color}
                              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                              className="w-9 h-9 bg-transparent border-0 cursor-pointer rounded"
                            />
                            <span className="text-xs text-slate-300 font-mono">{formData.color}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Hareket Maliyeti (Puan)</label>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="99"
                            value={formData.movementCost}
                            onChange={(e) => setFormData({ ...formData, movementCost: parseFloat(e.target.value) || 1 })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Noise Ranges */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/60 p-3 rounded-lg">
                        {/* Elevation Range */}
                        <div>
                          <span className="text-xs font-semibold text-amber-400 block mb-1">Yükseklik (Min-Maks)</span>
                          <div className="flex items-center gap-2 text-xs">
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={formData.minElevation}
                              onChange={(e) => setFormData({ ...formData, minElevation: parseFloat(e.target.value) })}
                              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                            />
                            <span>-</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={formData.maxElevation}
                              onChange={(e) => setFormData({ ...formData, maxElevation: parseFloat(e.target.value) })}
                              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                            />
                          </div>
                        </div>

                        {/* Temp Range */}
                        <div>
                          <span className="text-xs font-semibold text-rose-400 block mb-1">Sıcaklık (Min-Maks)</span>
                          <div className="flex items-center gap-2 text-xs">
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={formData.minTemperature}
                              onChange={(e) => setFormData({ ...formData, minTemperature: parseFloat(e.target.value) })}
                              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                            />
                            <span>-</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={formData.maxTemperature}
                              onChange={(e) => setFormData({ ...formData, maxTemperature: parseFloat(e.target.value) })}
                              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                            />
                          </div>
                        </div>

                        {/* Humidity Range */}
                        <div>
                          <span className="text-xs font-semibold text-cyan-400 block mb-1">Nem (Min-Maks)</span>
                          <div className="flex items-center gap-2 text-xs">
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={formData.minHumidity}
                              onChange={(e) => setFormData({ ...formData, minHumidity: parseFloat(e.target.value) })}
                              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                            />
                            <span>-</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={formData.maxHumidity}
                              onChange={(e) => setFormData({ ...formData, maxHumidity: parseFloat(e.target.value) })}
                              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200"
                        >
                          İptal
                        </button>
                        <button
                          onClick={handleSave}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs text-white font-medium flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Kaydet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded border border-slate-600 shadow"
                          style={{ backgroundColor: biome.color }}
                        />
                        <div>
                          <div className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                            <span>{biome.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                              Maliyet: {biome.movementCost >= 99 ? 'Geçilemez' : biome.movementCost}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Yüksek: {biome.minElevation}-{biome.maxElevation} | Sıcaklık: {biome.minTemperature}-
                            {biome.maxTemperature} | Nem: {biome.minHumidity}-{biome.maxHumidity}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(biome)}
                          className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(biome.id)}
                          className="p-1.5 hover:bg-rose-900/50 rounded text-slate-400 hover:text-rose-400"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Biyom değişikliklerini haritaya uygulamak için dünyayı yeniden üretebilirsiniz.</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm"
            >
              Kapat
            </button>
            <button
              onClick={handleApplyAll}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow"
            >
              Değişiklikleri Uygula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
