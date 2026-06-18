import { useState } from 'react';

export function useArtistSelection(initial = []) {
  const [selectedArtists, setSelectedArtists] = useState(initial);

  const handleSelectArtist = (artist) => {
    if (!selectedArtists.some((a) => a.id === artist.id && !a.isNew)) {
      setSelectedArtists([...selectedArtists, artist]);
    }
  };

  const handleRemoveArtist = (index) => {
    setSelectedArtists((prev) => prev.filter((_, i) => i !== index));
  };

  return { selectedArtists, setSelectedArtists, handleSelectArtist, handleRemoveArtist };
}
