import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { supabase } from '../../../api/supabase';
import { toNum } from '../../../utils/nutrition/nutritionFormat';
import { makeStyles } from './AddFoodScreen.styles';

export default function AddFoodScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { theme, t } = useSettings();
  const s = makeStyles(theme);
  const params = route?.params ?? {};

  const [name, setName] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [kcal, setKcal] = useState('');
  const [carb, setCarb] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [barcode, setBarcode] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const kcalNum = toNum(kcal);
  const carbNum = toNum(carb);
  const proteinNum = toNum(protein);
  const fatNum = toNum(fat);
  const displayServing = servingLabel.trim() || t('nutrition.servingDefault');

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          t('nutrition.scanBarcode'),
          t('nutrition.cameraPermission'),
        );
        return;
      }
    }
    scannedRef.current = false;
    setScanning(true);
  };
  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanning(false);
    setBarcode(data.replace(/\D/g, ''));
  };

  const onSave = async () => {
    if (!user?.id) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(t('nutrition.addFoodTitle'), t('nutrition.needName'));
      return;
    }
    if (!kcalNum || kcalNum <= 0) {
      Alert.alert(t('nutrition.addFoodTitle'), t('nutrition.needKcal'));
      return;
    }
    const cleanBarcode = barcode.replace(/\D/g, '');
    if (cleanBarcode && !/^[0-9]{8,14}$/.test(cleanBarcode)) {
      Alert.alert(t('nutrition.addFoodTitle'), t('nutrition.badBarcode'));
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('foods')
        .insert({
          owner_id: user.id,
          name: trimmedName,
          serving_label: displayServing,
          kcal_per_serving: kcalNum,
          carb_g: carbNum,
          protein_g: proteinNum,
          fat_g: fatNum,
          barcode: cleanBarcode || null,
          source: 'manual',
        })
        .select()
        .single();
      if (error) throw error;
      Keyboard.dismiss();
      if (params.mealType) {
        // SỬA LUỒNG Ở ĐÂY: merge: true để quay về AddMeal cũ
        // và giữ nguyên nháp cũ, không tạo AddMeal mới chồng lên AddFood.
        navigation.navigate({
          name: 'AddMeal',
          params: {
            mealType: params.mealType,
            date: params.date,
            addedFood: { ...data, addedAt: Date.now() },
          },
          merge: true,
        });
      } else {
        Alert.alert(t('nutrition.addFoodTitle'), t('nutrition.savedFood'), [
          { text: t('nutrition.ok'), onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e: any) {
      Alert.alert(
        t('nutrition.addFoodTitle'),
        e?.message ?? t('nutrition.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const field = (
    icon: any,
    iconBg: string,
    iconColor: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    numeric = false,
    fieldKey = label,
    inCard = false,
  ) => (
    <View style={[s.field, inCard && s.fieldInCard]}>
      <View style={s.fieldLabelRow}>
        <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={s.fieldLabel}>{label}</Text>
      </View>
      <TextInput
        style={[
          s.input,
          inCard && s.inputInCard,
          focused === fieldKey && {
            borderColor: theme.primaryDark,
            borderWidth: 1.5,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor='#999'
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        returnKeyType='done'
        onFocus={() => setFocused(fieldKey)}
        onBlur={() => setFocused(null)}
        onSubmitEditing={() => Keyboard.dismiss()}
      />
    </View>
  );

  const macroChip = (color: string, label: string, value: number) => (
    <View style={s.macroChip}>
      <View style={[s.macroDot, { backgroundColor: color }]} />
      <Text style={s.macroText}>
        {label} {value}g
      </Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={s.wrap}>
          <View style={s.header}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name='chevron-back' size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={s.title}>{t('nutrition.addFoodTitle')}</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode='on-drag'
          >
            <View style={s.noteBox}>
              <Ionicons
                name='information-circle-outline'
                size={20}
                color={theme.primaryDark}
              />
              <Text style={s.note}>{t('nutrition.addFoodNote')}</Text>
            </View>

            {field(
              'restaurant-outline',
              '#EAF6EC',
              '#2E7D32',
              t('nutrition.foodName'),
              name,
              setName,
              t('nutrition.foodNamePh'),
              false,
              'name',
            )}
            {field(
              'scale-outline',
              '#E3F2FD',
              '#1976D2',
              t('nutrition.servingLabel'),
              servingLabel,
              setServingLabel,
              t('nutrition.servingLabelPh'),
              false,
              'serving',
            )}

            <View style={s.macroCard}>
              {field(
                'flame-outline',
                '#FFF0E6',
                '#F57C00',
                t('nutrition.kcalPerServing'),
                kcal,
                setKcal,
                '0',
                true,
                'kcal',
                true,
              )}
              {field(
                'leaf-outline',
                '#F1F8E9',
                '#689F38',
                t('nutrition.carbPerServing'),
                carb,
                setCarb,
                '0',
                true,
                'carb',
                true,
              )}
              {field(
                'barbell-outline',
                '#FCE4EC',
                '#D81B60',
                t('nutrition.proteinPerServing'),
                protein,
                setProtein,
                '0',
                true,
                'protein',
                true,
              )}
              {field(
                'water-outline',
                '#FFF8E1',
                '#F57F17',
                t('nutrition.fatPerServing'),
                fat,
                setFat,
                '0',
                true,
                'fat',
                true,
              )}
            </View>

            <View style={s.field}>
              <View style={s.fieldLabelRow}>
                <View style={[s.iconCircle, { backgroundColor: '#EDE7F6' }]}>
                  <Ionicons name='barcode-outline' size={16} color='#5E35B1' />
                </View>
                <Text style={s.fieldLabel}>
                  {t('nutrition.barcodeOptional')}
                </Text>
              </View>
              <View style={s.barcodeRow}>
                <TextInput
                  style={[
                    s.input,
                    { flex: 1, marginBottom: 0 },
                    focused === 'barcode' && {
                      borderColor: theme.primaryDark,
                      borderWidth: 1.5,
                    },
                  ]}
                  value={barcode}
                  onChangeText={(v) => setBarcode(v.replace(/\D/g, ''))}
                  placeholder={t('nutrition.barcodePh')}
                  placeholderTextColor='#999'
                  keyboardType='number-pad'
                  returnKeyType='done'
                  onFocus={() => setFocused('barcode')}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <TouchableOpacity style={s.scanBtn} onPress={openScanner}>
                  <Ionicons name='camera-outline' size={22} color='#fff' />
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.preview}>
              <View style={s.previewHead}>
                <Text style={s.previewTitle}>
                  {t('nutrition.addFoodTitle')}
                </Text>
                <View style={s.kcalBadge}>
                  <Text style={s.kcalBadgeText}>{kcalNum} kcal</Text>
                </View>
              </View>
              <Text style={s.previewName}>{name.trim() || '—'}</Text>
              <Text style={s.previewSub}>{displayServing}</Text>
              <View style={s.macroRow}>
                {macroChip('#689F38', t('nutrition.carbs'), carbNum)}
                {macroChip('#D81B60', t('nutrition.protein'), proteinNum)}
                {macroChip('#F57F17', t('nutrition.fat'), fatNum)}
              </View>
              {barcode ? (
                <View style={s.barcodePreview}>
                  <Ionicons name='barcode-outline' size={16} color='#5E35B1' />
                  <Text style={s.previewSub}>{barcode}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity
              style={s.hideBtn}
              onPress={() => Keyboard.dismiss()}
            >
              <Ionicons name='keypad-outline' size={20} color={theme.text} />
              <Text style={s.hideText}>{t('nutrition.hideKeyboard')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color='#fff' />
              ) : (
                <>
                  <Ionicons name='checkmark' size={20} color='#fff' />
                  <Text style={s.saveText}>{t('nutrition.saveFood')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Modal visible={scanning} animationType='slide'>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <CameraView
                style={{ flex: 1 }}
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'ean13',
                    'ean8',
                    'upc_a',
                    'upc_e',
                    'code128',
                    'qr',
                  ],
                }}
                onBarcodeScanned={onBarcodeScanned}
              />
              <View style={s.scanOverlay} pointerEvents='none'>
                <View style={s.scanFrame} />
                <Text style={s.scanHint}>{t('nutrition.scanBarcode')}</Text>
              </View>
              <TouchableOpacity
                style={s.closeScanBtn}
                onPress={() => setScanning(false)}
              >
                <Ionicons name='close' size={22} color='#111' />
              </TouchableOpacity>
            </View>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  );
}
