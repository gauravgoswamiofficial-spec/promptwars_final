
import React, { useState } from 'react';
import { ARCHITECTURE_SECTIONS } from '../constants';

interface ArchitectureDocsProps {
  onBack: () => void;
}

const ArchitectureDocs: React.FC<ArchitectureDocsProps> = ({ onBack }) => {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto p-6 md:p-12 text-slate-200">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-orbitron font-bold text-cyan-400 tracking-tighter">
            SYSTEM ARCHITECTURE
          </h1>
          <button 
            onClick={onBack}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 transition-all font-semibold"
          >
            <i className="fa fa-arrow-left mr-2"></i> RETURN TO GAME
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-4">
            {ARCHITECTURE_SECTIONS.map((section, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIdx(idx)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeIdx === idx 
                    ? 'bg-cyan-900/30 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <i className={`fa ${section.icon} mr-3 ${activeIdx === idx ? 'text-cyan-400' : 'text-slate-500'}`}></i>
                <span className={activeIdx === idx ? 'font-bold' : ''}>{section.title}</span>
              </button>
            ))}
          </div>

          <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-md">
            <h2 className="text-2xl font-orbitron text-cyan-400 mb-6 flex items-center">
              <i className={`fa ${ARCHITECTURE_SECTIONS[activeIdx].icon} mr-4`}></i>
              {ARCHITECTURE_SECTIONS[activeIdx].title}
            </h2>
            <div className="prose prose-invert max-w-none leading-relaxed text-slate-300 whitespace-pre-line">
              {ARCHITECTURE_SECTIONS[activeIdx].content}
            </div>
            
            <div className="mt-12 pt-8 border-t border-slate-800">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Implementation Notes</h3>
              <ul className="grid grid-cols-2 gap-4 text-xs">
                <li className="flex items-center text-green-400"><i className="fa fa-check-circle mr-2"></i> Modular Folder Structure</li>
                <li className="flex items-center text-green-400"><i className="fa fa-check-circle mr-2"></i> Low Latency Networking</li>
                <li className="flex items-center text-green-400"><i className="fa fa-check-circle mr-2"></i> Battery Optimization</li>
                <li className="flex items-center text-green-400"><i className="fa fa-check-circle mr-2"></i> Crashlytics Ready</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureDocs;
