/**
 * apps/mobile/app/settings/appearance.tsx
 *
 * Dedicated Appearance & Materials Settings Screen:
 *  - Theme Mode: System / Light / Dark
 *  - Blur Level: 0 to 40 (maps to native intensity 0-100)
 *  - Reduce Transparency Switch: Solid opaque surfaces
 *  - Reduced Motion: System / On / Off
 *  - Live Staged Preview with Save & Cancel behavior
 *  - useUnsavedChangesGuard backed by usePreventRemove
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { useUnsavedChangesGuard } from '../../utils/useUnsavedChangesGuard';
import { AppearanceModeOption, ReducedMotionOption } from '../../services/settings';

export default function AppearanceSettingsScreen() {
  const router = useRouter();
  const {
    palette,
    metrics,
    userSettings,
    stagePreview,
    saveStagedAppearance,
  } = useTheme();

  // Local staged state
  const [stagedMode, setStagedMode] = useState<AppearanceModeOption>(
    userSettings.appearanceMode || 'system'
  );
  const [stagedBlur, setStagedBlur] = useState<number>(userSettings.blurRadius ?? 20);
  const [stagedSolid, setStagedSolid] = useState<boolean>(
    Boolean(userSettings.reduceTransparency)
  );
  const [stagedMotion, setStagedMotion] = useState<ReducedMotionOption>(
    userSettings.reducedMotion || 'system'
  );
  const [isDirty, setIsDirty] = useState(false);

  // Hook into navigation removal prevention
  useUnsavedChangesGuard(isDirty, {
    onDiscard: () => {
      stagePreview(null); // Roll back live preview
      setIsDirty(false);
    },
  });

  // Stage changes to live preview
  const updateStaged = (
    mode: AppearanceModeOption,
    blur: number,
    solid: boolean,
    motion: ReducedMotionOption
  ) => {
    setStagedMode(mode);
    setStagedBlur(blur);
    setStagedSolid(solid);
    setStagedMotion(motion);
    setIsDirty(true);
    stagePreview({
      appearanceMode: mode,
      blurRadius: blur,
      reduceTransparency: solid,
      reducedMotion: motion,
    });
  };

  const handleSave = () => {
    saveStagedAppearance();
    setIsDirty(false);
    router.back();
  };

  const handleCancel = () => {
    stagePreview(null);
    setIsDirty(false);
    router.back();
  };

  // Stepper adjustments for blur level
  const adjustBlur = (delta: number) => {
    const next = Math.max(0, Math.min(40, stagedBlur + delta));
    updateStaged(stagedMode, next, stagedSolid, stagedMotion);
  };

  const nativeIntensity = Math.round((stagedBlur / 40) * 100);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Appearance & Materials"
        rightActionText={isDirty ? 'Save' : undefined}
        onRightAction={handleSave}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Live Material Hero Badge */}
        <LiquidGlassSurface style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <Ionicons name="color-palette" size={26} color="#10b981" />
          </View>
          <Text style={[styles.heroTitle, { color: palette.textPrimary }]}>
            Liquid Glass Material Engine
          </Text>
          <Text style={[styles.heroDesc, { color: palette.textSecondary }]}>
            Native hardware-accelerated blur, layered diffusion, and accessibility controls.
            Changes apply to this live preview immediately.
          </Text>
        </LiquidGlassSurface>

        {/* Section 1: Appearance Mode */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          THEME APPEARANCE
        </Text>
        <LiquidGlassSurface style={styles.card}>
          <Text style={[styles.fieldHint, { color: palette.textSecondary }]}>
            Choose interface theme or synchronize with device system settings:
          </Text>
          <View style={styles.segmentedRow}>
            {(['system', 'light', 'dark'] as AppearanceModeOption[]).map((mode) => {
              const active = stagedMode === mode;
              const label =
                mode === 'system'
                  ? '⚙️ System'
                  : mode === 'light'
                  ? '☀️ Light'
                  : '🌙 Dark';
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.segmentButton,
                    active && {
                      backgroundColor: palette.surfaceElevated,
                      borderColor: palette.borderStrong,
                    },
                  ]}
                  onPress={() => updateStaged(mode, stagedBlur, stagedSolid, stagedMotion)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? palette.textPrimary : palette.textSecondary },
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LiquidGlassSurface>

        {/* Section 2: Backdrop Blur Level & Solid Surfaces */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          LIQUID GLASS DIFFUSION
        </Text>
        <LiquidGlassSurface style={styles.card}>
          {/* Blur Level Stepper */}
          <View style={[styles.controlRow, { borderBottomColor: palette.divider }]}>
            <View style={styles.controlMeta}>
              <Text style={[styles.controlTitle, { color: palette.textPrimary }]}>
                Backdrop Blur Level
              </Text>
              <Text style={[styles.controlDesc, { color: palette.textSecondary }]}>
                Controls diffusion intensity (0 to 40 level)
              </Text>
            </View>
            <View style={styles.stepperWrap}>
              <TouchableOpacity
                onPress={() => adjustBlur(-5)}
                disabled={stagedSolid || stagedBlur <= 0}
                style={[
                  styles.stepperBtn,
                  { backgroundColor: palette.surfaceInput },
                  (stagedSolid || stagedBlur <= 0) && styles.btnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Decrease blur level"
              >
                <Ionicons name="remove" size={18} color={palette.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.stepperValueText, { color: '#10b981' }]}>
                {stagedSolid ? '0 (Solid)' : `${stagedBlur} lvl`}
              </Text>
              <TouchableOpacity
                onPress={() => adjustBlur(5)}
                disabled={stagedSolid || stagedBlur >= 40}
                style={[
                  styles.stepperBtn,
                  { backgroundColor: palette.surfaceInput },
                  (stagedSolid || stagedBlur >= 40) && styles.btnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Increase blur level"
              >
                <Ionicons name="add" size={18} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {stagedSolid ? (
            <View style={styles.warningNote}>
              <Ionicons name="warning-outline" size={16} color="#f59e0b" />
              <Text style={styles.warningText}>
                Blur is overridden while Solid Surfaces fallback is enabled.
              </Text>
            </View>
          ) : (
            <View style={styles.techNote}>
              <Text style={[styles.techNoteText, { color: palette.textSecondary }]}>
                Maps to native intensity:{' '}
                <Text style={{ fontWeight: '700', color: palette.textPrimary }}>
                  {nativeIntensity}%
                </Text>{' '}
                on iOS & Android.
              </Text>
            </View>
          )}

          {/* Reduce Transparency Switch */}
          <View style={[styles.switchRow, { borderTopColor: palette.divider }]}>
            <View style={styles.controlMeta}>
              <Text style={[styles.controlTitle, { color: palette.textPrimary }]}>
                Reduce Transparency
              </Text>
              <Text style={[styles.controlDesc, { color: palette.textSecondary }]}>
                Switch to opaque surfaces for maximum contrast
              </Text>
            </View>
            <Switch
              value={stagedSolid}
              onValueChange={(val) => updateStaged(stagedMode, stagedBlur, val, stagedMotion)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#10b981' }}
              thumbColor="#ffffff"
              accessibilityRole="switch"
              accessibilityLabel="Reduce Transparency"
            />
          </View>
        </LiquidGlassSurface>

        {/* Section 3: Reduced Motion */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          MOTION & ANIMATIONS
        </Text>
        <LiquidGlassSurface style={styles.card}>
          <Text style={[styles.fieldHint, { color: palette.textSecondary }]}>
            Disable nonessential spring physics and transitions:
          </Text>
          <View style={styles.segmentedRow}>
            {(['system', 'on', 'off'] as ReducedMotionOption[]).map((motion) => {
              const active = stagedMotion === motion;
              const label =
                motion === 'system'
                  ? '⚙️ System'
                  : motion === 'on'
                  ? '🚫 On'
                  : '✨ Off (Fluid)';
              return (
                <TouchableOpacity
                  key={motion}
                  style={[
                    styles.segmentButton,
                    active && {
                      backgroundColor: palette.surfaceElevated,
                      borderColor: palette.borderStrong,
                    },
                  ]}
                  onPress={() => updateStaged(stagedMode, stagedBlur, stagedSolid, motion)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? palette.textPrimary : palette.textSecondary },
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LiquidGlassSurface>

        {/* Bottom Action Bar */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: palette.border }]}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.cancelBtnText, { color: palette.textPrimary }]}>
              {isDirty ? 'Cancel' : 'Back'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, !isDirty && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isDirty}
            accessibilityRole="button"
            accessibilityLabel="Save Changes"
          >
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 10,
  },
  card: {
    padding: 14,
    marginBottom: 14,
  },
  fieldHint: {
    fontSize: 12,
    marginBottom: 10,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  controlMeta: {
    flex: 1,
    paddingRight: 10,
  },
  controlTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  controlDesc: {
    fontSize: 11.5,
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 54,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  warningNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 8,
    borderRadius: 8,
    marginVertical: 10,
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 11,
    flex: 1,
  },
  techNote: {
    paddingVertical: 8,
  },
  techNoteText: {
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: '#070b0e',
    fontSize: 14,
    fontWeight: '700',
  },
});
