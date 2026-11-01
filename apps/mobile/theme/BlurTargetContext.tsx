import React, { createContext, useContext } from 'react';

export const BlurTargetContext = createContext<React.RefObject<any> | null>(null);

export const BlurTargetProvider = BlurTargetContext.Provider;

export function useBlurTarget(): React.RefObject<any> | null {
  return useContext(BlurTargetContext);
}
