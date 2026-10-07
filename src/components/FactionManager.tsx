import React, { useState } from 'react';
import type { Faction, FactionRelation, RelationStatus } from '../types/map';
import { Flag, Plus, Trash2, Shield, Swords, Handshake, Users, X } from 'lucide-react';

interface FactionManagerProps {
  factions: Faction[];
  relations: FactionRelation[];
  onUpdateFactions: (factions: Faction[]) => void;
  onUpdateRelations: (relations: FactionRelation[]) => void;
  onClose: () => void;
}

export const FactionManager: React.FC<FactionManagerProps> = ({
  factions,
  relations,
  onUpdateFactions,
  onUpdateRelations,
  onClose,
}) => {
  const [factionList, setFactionList] = useState<Faction[]>(factions);
  const [relationList, setRelationList] = useState<FactionRelation[]>(relations);
  const [newFactionName, setNewFactionName] = useState('');
  const [newFactionColor, setNewFactionColor] = useState('#e11d48');

  const handleAddFaction = () => {
    if (!newFactionName.trim()) return;
    const newFaction: Faction = {
      id: `fac_${Date.now()}`,
      name: newFactionName.trim(),
      color: newFactionColor,
      description: 'Yeni Krallık / Bölge',
    };
    setFactionList([...factionList, newFaction]);
    setNewFactionName('');
  };

  const handleDeleteFaction = (id: string) => {
    setFactionList(factionList.filter((f) => f.id !== id));
    setRelationList(relationList.filter((r) => r.factionId1 !== id && r.factionId2 !== id));
  };

  const getRelation = (id1: string, id2: string): RelationStatus => {
    const found = relationList.find(
      (r) => (r.factionId1 === id1 && r.factionId2 === id2) || (r.factionId1 === id2 && r.factionId2 === id1)
    );
    return found ? found.status : 'neutral';
  };

  const setRelation = (id1: string, id2: string, status: RelationStatus) => {
    const filtered = relationList.filter(
      (r) => !(r.factionId1 === id1 && r.factionId2 === id2) && !(r.factionId1 === id2 && r.factionId2 === id1)
    );
    filtered.push({ factionId1: id1, factionId2: id2, status });
    setRelationList(filtered);
  };

  const handleSaveAll = () => {
    onUpdateFactions(factionList);
    onUpdateRelations(relationList);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-lg">
            <Flag className="w-5 h-5" />
            <span>Politik Harita & Krallık İlişkileri Yönetimi</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Add Faction Bar */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div className="font-semibold text-sm text-slate-200">Yeni Krallık / Bölge Ekle:</div>
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <input
                type="text"
                placeholder="Krallık / Faction Adı"
                value={newFactionName}
                onChange={(e) => setNewFactionName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-rose-500"
              />
              <input
                type="color"
                value={newFactionColor}
                onChange={(e) => setNewFactionColor(e.target.value)}
                className="w-9 h-9 bg-transparent border-0 cursor-pointer"
              />
              <button
                onClick={handleAddFaction}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition"
              >
                <Plus className="w-4 h-4" /> Ekle
              </button>
            </div>
          </div>

          {/* Factions List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Mevcut Krallıklar</h3>
            {factionList.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Henüz hiç krallık oluşturulmadı.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {factionList.map((fac) => (
                  <div
                    key={fac.id}
                    className="bg-slate-800/40 border border-slate-700/80 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border border-slate-500 shadow" style={{ backgroundColor: fac.color }} />
                      <div>
                        <div className="font-semibold text-sm text-slate-100">{fac.name}</div>
                        <div className="text-xs text-slate-400">{fac.description}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFaction(fac.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inter-Faction Relations Matrix */}
          {factionList.length >= 2 && (
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Handshake className="w-4 h-4 text-indigo-400" /> Diplomatik İlişkiler Matrixi
              </h3>
              <div className="space-y-2">
                {factionList.map((f1, i) =>
                  factionList.slice(i + 1).map((f2) => {
                    const status = getRelation(f1.id, f2.id);

                    return (
                      <div
                        key={`${f1.id}_${f2.id}`}
                        className="bg-slate-800/30 border border-slate-700/60 rounded-lg p-3 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-2 text-sm text-slate-200">
                          <span style={{ color: f1.color }} className="font-semibold">
                            {f1.name}
                          </span>
                          <span className="text-slate-500">↔</span>
                          <span style={{ color: f2.color }} className="font-semibold">
                            {f2.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRelation(f1.id, f2.id, 'alliance')}
                            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium transition ${
                              status === 'alliance'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <Handshake className="w-3.5 h-3.5" /> İttifak
                          </button>

                          <button
                            onClick={() => setRelation(f1.id, f2.id, 'neutral')}
                            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium transition ${
                              status === 'neutral'
                                ? 'bg-slate-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <Users className="w-3.5 h-3.5" /> Tarafsız
                          </button>

                          <button
                            onClick={() => setRelation(f1.id, f2.id, 'war')}
                            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium transition ${
                              status === 'war'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <Swords className="w-3.5 h-3.5" /> Savaş
                          </button>

                          <button
                            onClick={() => setRelation(f1.id, f2.id, 'vassal')}
                            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium transition ${
                              status === 'vassal'
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" /> Vasal / Bağımlı
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm">
            İptal
          </button>
          <button
            onClick={handleSaveAll}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold shadow"
          >
            Kaydet ve Uygula
          </button>
        </div>
      </div>
    </div>
  );
};
