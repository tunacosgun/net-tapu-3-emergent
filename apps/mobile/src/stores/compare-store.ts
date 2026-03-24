import { create } from 'zustand';
import type { Parcel } from '../types';

interface CompareStore {
  selectedParcels: Parcel[];
  maxSelections: number;
  isOpen: boolean;

  toggleParcel: (parcel: Parcel) => void;
  isSelected: (parcelId: string) => boolean;
  clearAll: () => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  selectedParcels: [],
  maxSelections: 4,
  isOpen: false,

  toggleParcel: (parcel) => {
    const { selectedParcels, maxSelections } = get();
    const exists = selectedParcels.find((p) => p.id === parcel.id);

    if (exists) {
      set({ selectedParcels: selectedParcels.filter((p) => p.id !== parcel.id) });
    } else if (selectedParcels.length < maxSelections) {
      set({ selectedParcels: [...selectedParcels, parcel] });
    }
  },

  isSelected: (parcelId) => {
    return get().selectedParcels.some((p) => p.id === parcelId);
  },

  clearAll: () => set({ selectedParcels: [], isOpen: false }),

  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}));
