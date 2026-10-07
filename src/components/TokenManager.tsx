import React, { useState } from 'react';
import type { MapToken } from '../types/map';
import { Shield, Plus, Trash2, X } from 'lucide-react';

interface TokenManagerProps {
  tokens: MapToken[];
  onUpdateTokens: (tokens: MapToken[]) => void;
  onClose: () => void;
  selectedTileKey: string | null;
}

export const TokenManager: React.FC<TokenManagerProps> = ({
  tokens,
  onUpdateTokens,
  onClose,
  selectedTileKey,
}) => {
  const [tokenList, setTokenList] = useState<MapToken[]>(tokens);
  const [name, setName] = useState('');
  const [type, setType] = useState<MapToken['type']>('player');
  const [icon, setIcon] = useState('🧙‍♂️');
  const [color, setColor] = useState('#3b82f6');

  const handleAddToken = () => {
    if (!selectedTileKey) {
      alert('Lütfen haritadan token yerleştirmek için önce bir tile seçin!');
      return;
    }
    const [qStr, rStr] = selectedTileKey.split(',');
    const q = parseInt(qStr, 10);
    const r = parseInt(rStr, 10);

    const newToken: MapToken = {
      id: `tok_${Date.now()}`,
      name: name.trim() || 'Yeni Token',
      type,
      icon,
      color,
      q,
      r,
    };

    const updated = [...tokenList, newToken];
    setTokenList(updated);
    onUpdateTokens(updated);
    setName('');
  };

  const handleDeleteToken = (id: string) => {
    const updated = tokenList.filter((t) => t.id !== id);
    setTokenList(updated);
    onUpdateTokens(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 text-pink-400 font-bold text-lg">
            <Shield className="w-5 h-5" />
            <span>Özel Harita Token Yönetimi</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Tile Selection Info */}
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 flex items-center justify-between text-xs">
            <span className="text-slate-300">Seçili Karo (Tile):</span>
            <span className="font-mono text-indigo-400 font-bold">
              {selectedTileKey ? `(${selectedTileKey})` : 'Tile Seçilmedi (Haritada tıklayın)'}
            </span>
          </div>

          {/* Add Token Form */}
          <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/80">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Token Ekle</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Token Adı</label>
                <input
                  type="text"
                  placeholder="Ör. Gandalf / Ejderha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Kategori</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MapToken['type'])}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500"
                >
                  <option value="player">Oyuncu (PC)</option>
                  <option value="monster">Canavar / Düşman</option>
                  <option value="npc">NPC / Dost</option>
                  <option value="object">Eşya / Obje</option>
                  <option value="quest">Görev İşareti</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">İkon / Emoji</label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white text-center focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Token Rengi</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300 font-mono">{color}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddToken}
              disabled={!selectedTileKey}
              className="w-full py-2 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition"
            >
              <Plus className="w-4 h-4" /> Seçili Karoya Token Yerleştir
            </button>
          </div>

          {/* Token List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Haritadaki Token'lar</h3>
            {tokenList.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Haritada henüz token yok.</p>
            ) : (
              <div className="space-y-2">
                {tokenList.map((tok) => (
                  <div
                    key={tok.id}
                    className="bg-slate-800/40 border border-slate-700 rounded-lg p-2.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm border border-slate-400 shadow"
                        style={{ backgroundColor: tok.color }}
                      >
                        {tok.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-slate-100">{tok.name}</div>
                        <div className="text-[10px] text-slate-400">
                          Konum: ({tok.q}, {tok.r}) | Tip: {tok.type}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteToken(tok.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs">
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
