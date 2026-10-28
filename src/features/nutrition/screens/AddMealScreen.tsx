import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import {
  aiToDraft,
  analyzeMealPhoto,
  deleteMealItem,
  draftTotals,
  fetchBarcodeProduct,
  getFrequentFoods,
  getNutritionDay,
  saveMeal,
  searchFoods,
  toLocalDateString,
  uuidv4,
  type AiSuggestionItem,
  type BarcodeProduct,
  type DraftItem,
  type Food,
  type LoggedItem,
  type MealType,
} from '../../../lib/nutritionApi';

const AI_CARD_IMAGE = require('../../../../assets/images/meal.jpg');

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🍱',
  dinner: '🍲',
  snack: '🍩',
};
const MACRO_DOT_COLORS = {
  carbs: '#4E8A47',
  protein: '#A63D2F',
  fat: '#E8B84B',
};
const PRESET_SUGGESTIONS = [
  'Cơm trắng',
  'Trứng luộc',
  'Ức gà luộc',
  'Chuối',
  'Phở bò',
  'Bún chả',
  'Tôm hấp',
];
const EXCLUDED_SUGGESTION_NAMES = new Set(['sữa tươi không đường']);
const isExcludedSuggestion = (name: string) =>
  EXCLUDED_SUGGESTION_NAMES.has(name.trim().toLowerCase());
const EMPTY_DRAFTS: Record<MealType, DraftItem[]> = {
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: [],
};
function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const toNum = (s: string, fallback = 0) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

function BarcodeIcon() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <View style={{ width: 3, height: 22, backgroundColor: '#000' }} />
      <View style={{ width: 2, height: 22, backgroundColor: '#000' }} />
      <View style={{ width: 4, height: 22, backgroundColor: '#000' }} />
      <View style={{ width: 2, height: 22, backgroundColor: '#000' }} />
      <View style={{ width: 3, height: 22, backgroundColor: '#000' }} />
    </View>
  );
}

export default function AddMealScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { theme, t } = useSettings();
  const s = makeStyles(theme);

  const params = route?.params ?? {};
  const today = toLocalDateString(new Date());
  const [mealType, setMealType] = useState<MealType>(
    params.mealType ?? defaultMealType(),
  );
  const [date] = useState<string>(params.date ?? today);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [frequent, setFrequent] = useState<Food[]>([]);
  const [barcode, setBarcode] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(
    null,
  );
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPhotoUri, setAiPhotoUri] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionItem[]>([]);
  const [drafts, setDrafts] =
    useState<Record<MealType, DraftItem[]>>(EMPTY_DRAFTS);
  const draft = drafts[mealType] ?? [];
  const [savedItems, setSavedItems] = useState<LoggedItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSaved = useCallback(async () => {
    if (!user?.id) return;
    setSavedLoading(true);
    try {
      const day = await getNutritionDay(user.id, date);
      setSavedItems(day.meals[mealType] ?? []);
    } catch {
      setSavedItems([]);
    } finally {
      setSavedLoading(false);
    }
  }, [user?.id, date, mealType]);

  const loadFrequent = useCallback(async () => {
    if (!user?.id) return;
    try {
      const list = await getFrequentFoods(user.id);
      setFrequent(list.filter((f) => !isExcludedSuggestion(f.name)));
    } catch {
      setFrequent([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);
  useEffect(() => {
    loadFrequent();
  }, [loadFrequent]);
  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadSaved(), loadFrequent()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadSaved, loadFrequent]);

  const addDraftToMeal = useCallback((item: DraftItem, target: MealType) => {
    setDrafts((prev) => ({
      ...prev,
      [target]: [...(prev[target] ?? []), item],
    }));
  }, []);
  const addFood = useCallback(
    (food: Food) => {
      addDraftToMeal(
        {
          key: `lib-${Date.now()}-${food.id}`,
          foodId: food.id,
          name: food.name,
          servingLabel: food.servingLabel,
          servings: 1,
          kcalPerServing: food.kcalPerServing,
          carbPerServing: food.carbG,
          proteinPerServing: food.proteinG,
          fatPerServing: food.fatG,
          source: 'library',
        },
        mealType,
      );
      setQuery('');
      setResults([]);
    },
    [addDraftToMeal, mealType],
  );

  const addedFoodRef = useRef<string | null>(null);
  useEffect(() => {
    const added = params.addedFood;
    if (!added?.id) return;
    const stamp = `${added.id}-${added.addedAt ?? ''}`;
    if (addedFoodRef.current === stamp) return;
    addedFoodRef.current = stamp;
    const target = (params.mealType ?? mealType) as MealType;
    addDraftToMeal(
      {
        key: `lib-${Date.now()}-${added.id}`,
        foodId: added.id,
        name: added.name,
        servingLabel: added.serving_label ?? t('nutrition.servingDefault'),
        servings: 1,
        kcalPerServing: toNum(String(added.kcal_per_serving)),
        carbPerServing: toNum(String(added.carb_g)),
        proteinPerServing: toNum(String(added.protein_g)),
        fatPerServing: toNum(String(added.fat_g)),
        source: 'library',
      },
      target,
    );
  }, [params.addedFood, params.mealType, addDraftToMeal, mealType, t]);

  useEffect(() => {
    const q = query.trim();
    if (!user?.id || q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchFoods(user.id, q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, user?.id]);

  const draftSum = draftTotals(draft);
  const savedTotals = useMemo(() => {
    return savedItems.reduce(
      (acc, it) => ({
        kcal: acc.kcal + it.kcal,
        carb: acc.carb + it.carbG,
        protein: acc.protein + it.proteinG,
        fat: acc.fat + it.fatG,
      }),
      { kcal: 0, carb: 0, protein: 0, fat: 0 },
    );
  }, [savedItems]);
  const mealTotals = {
    kcal: round1(savedTotals.kcal + draftSum.kcal),
    carb: round1(savedTotals.carb + draftSum.carb),
    protein: round1(savedTotals.protein + draftSum.protein),
    fat: round1(savedTotals.fat + draftSum.fat),
  };
  const mealGrams = mealTotals.carb + mealTotals.protein + mealTotals.fat;
  const gramPct = (g: number) =>
    mealGrams > 0 ? Math.round((g / mealGrams) * 100) : 0;

  const changeServings = (key: string, delta: number) => {
    setDrafts((prev) => ({
      ...prev,
      [mealType]: (prev[mealType] ?? []).map((it) =>
        it.key === key
          ? { ...it, servings: Math.max(0.5, round1(it.servings + delta)) }
          : it,
      ),
    }));
  };
  const removeDraft = (key: string) => {
    setDrafts((prev) => ({
      ...prev,
      [mealType]: (prev[mealType] ?? []).filter((it) => it.key !== key),
    }));
  };
  const deleteSavedItem = (item: LoggedItem) => {
    Alert.alert(t('common.delete'), t('nutrition.deleteItemConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMealItem(item.id);
            await loadSaved();
          } catch (e: any) {
            Alert.alert(
              t('common.delete'),
              e?.message ?? t('nutrition.deleteFailed'),
            );
          }
        },
      },
    ]);
  };

  const findBarcode = async (clean: string) => {
    setBarcodeLoading(true);
    try {
      const p = await fetchBarcodeProduct(clean);
      setScannedProduct(p);
      setBarcode('');
    } catch (e: any) {
      Alert.alert(
        t('nutrition.scanBarcode'),
        e?.message === 'barcode_no_nutrition'
          ? t('nutrition.barcodeNoNutrition')
          : t('nutrition.barcodeNotFound'),
      );
    } finally {
      setBarcodeLoading(false);
    }
  };
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
    const clean = data.replace(/\D/g, '');
    if (clean.length >= 8) findBarcode(clean);
  };
  const addScannedToDraft = () => {
    if (!scannedProduct) return;
    addDraftToMeal(
      {
        key: `bc-${Date.now()}`,
        foodId: null,
        name: scannedProduct.name,
        servingLabel: '100 g',
        servings: 1,
        kcalPerServing: scannedProduct.kcal100,
        carbPerServing: scannedProduct.carb100,
        proteinPerServing: scannedProduct.protein100,
        fatPerServing: scannedProduct.fat100,
        source: 'barcode',
        barcode: scannedProduct.barcode,
      },
      mealType,
    );
  };

  const handleProcessImage = async (sourceType: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (sourceType === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            t('nutrition.aiCamera'),
            t('nutrition.cameraPermissionDenied'),
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            t('nutrition.aiCamera'),
            t('nutrition.libraryPermissionDenied'),
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const assetUri = result.assets[0].uri;
      setAiPhotoUri(assetUri);
      setAiLoading(true);

      const manip = await ImageManipulator.manipulateAsync(
        assetUri,
        [{ resize: { width: 1024 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      const base64Data = manip.base64;
      if (!base64Data) {
        throw new Error('Could not process image');
      }

      const items = await analyzeMealPhoto(base64Data);
      setAiSuggestions(items);
      if (items.length === 0) {
        Alert.alert(t('nutrition.aiCamera'), t('nutrition.aiEmpty'));
      }
    } catch (e: any) {
      Alert.alert(
        t('nutrition.aiCamera'),
        e?.message === 'ai_not_configured'
          ? t('nutrition.aiNotInstalled')
          : (e?.message ?? String(e)),
      );
    } finally {
      setAiLoading(false);
    }
  };

  const onAiPhoto = () => {
    Alert.alert(t('nutrition.choosePhotoSource'), t('nutrition.aiCameraDesc'), [
      {
        text: t('nutrition.takeNewPhoto'),
        onPress: () => handleProcessImage('camera'),
      },
      {
        text: t('nutrition.chooseFromLibrary'),
        onPress: () => handleProcessImage('library'),
      },
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
    ]);
  };

  const onSave = async () => {
    if (!user?.id) return;
    // Nháp rỗng là hủy thêm món, không phải lưu thành công, nên chỉ quay về màn trước.
    if (draft.length === 0) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const [y, m, d] = date.split('-').map(Number);
      const eaten = new Date(y, m - 1, d, now.getHours(), now.getMinutes());
      await saveMeal(user.id, {
        mealId: uuidv4(),
        mealType,
        eatenAtISO: eaten.toISOString(),
        photoPath: null,
        items: draft,
      });
      setDrafts((prev) => ({ ...prev, [mealType]: [] }));
      await loadSaved();
      Alert.alert(t('nutrition.draft'), t('nutrition.saved'), [
        {
          text: t('nutrition.ok'),
          onPress: () => navigation.popTo('Nutrition'),
        },
      ]);
    } catch (e: any) {
      Alert.alert(
        t('nutrition.draft'),
        e?.message ?? t('nutrition.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const showSuggestions = query.trim().length < 2;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.back}>‹</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t('nutrition.title')}</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={s.tabs}>
            {MEAL_ORDER.map((type) => (
              <TouchableOpacity
                key={type}
                style={[s.tab, mealType === type && s.tabActive]}
                onPress={() => setMealType(type)}
              >
                <Text style={[s.tabText, mealType === type && s.tabTextActive]}>
                  {MEAL_ICONS[type]} {t(`nutrition.${type}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.searchBox}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder={t('nutrition.searchPlaceholder')}
              placeholderTextColor='#999'
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {showSuggestions && (
            <View style={{ marginBottom: 8 }}>
              <Text style={s.section}>{t('nutrition.suggestions')}</Text>
              <View style={s.chips}>
                {[...PRESET_SUGGESTIONS, ...frequent.map((f) => f.name)]
                  .filter(
                    (v, i, a) => a.indexOf(v) === i && !isExcludedSuggestion(v),
                  )
                  .slice(0, 8)
                  .map((chip) => (
                    <TouchableOpacity
                      key={chip}
                      style={s.chip}
                      onPress={() => setQuery(chip)}
                    >
                      <Text style={s.chipText}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}

          {searching && <ActivityIndicator color={theme.primaryDark} />}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <Text style={s.hint}>{t('nutrition.noResult')}</Text>
          )}
          {results.map((f) => (
            <View key={f.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{f.name}</Text>
                <Text style={s.rowSub}>
                  {f.servingLabel} · {f.kcalPerServing} kcal
                </Text>
              </View>
              <TouchableOpacity style={s.plusBtn} onPress={() => addFood(f)}>
                <Text style={s.plusText}>+</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Text style={s.section}>{t('nutrition.scanBarcode')}</Text>
          <View style={s.barcodeRow}>
            <TextInput
              style={s.barcodeInput}
              placeholder={t('nutrition.barcodePlaceholder')}
              placeholderTextColor='#999'
              keyboardType='number-pad'
              returnKeyType='search'
              value={barcode}
              onChangeText={setBarcode}
              onSubmitEditing={() => {
                const clean = barcode.replace(/\D/g, '');
                if (clean.length >= 8) findBarcode(clean);
              }}
            />
            <TouchableOpacity style={s.barcodeIconBtn} onPress={openScanner}>
              <BarcodeIcon />
            </TouchableOpacity>
          </View>
          {barcodeLoading && <ActivityIndicator color={theme.primaryDark} />}

          {scannedProduct && (
            <View style={s.scannedCard}>
              <View style={s.scannedHeader}>
                <Text style={s.scannedTitle}>
                  {t('nutrition.scannedProduct')}
                </Text>
                <TouchableOpacity onPress={() => setScannedProduct(null)}>
                  <Text style={s.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={s.scannedBody}>
                <View style={{ flex: 1 }}>
                  <Text style={s.scannedName}>{scannedProduct.name}</Text>
                  <Text style={s.rowSub}>{scannedProduct.barcode}</Text>
                  <Text style={s.scannedKcal}>
                    {scannedProduct.kcal100} kcal {t('nutrition.per100g')}
                  </Text>
                  <Text
                    style={[s.scannedMacro, { color: MACRO_DOT_COLORS.carbs }]}
                  >
                    ● {t('nutrition.carbs')} {scannedProduct.carb100}g
                  </Text>
                  <Text
                    style={[
                      s.scannedMacro,
                      { color: MACRO_DOT_COLORS.protein },
                    ]}
                  >
                    ● {t('nutrition.protein')} {scannedProduct.protein100}g
                  </Text>
                  <Text
                    style={[s.scannedMacro, { color: MACRO_DOT_COLORS.fat }]}
                  >
                    ● {t('nutrition.fat')} {scannedProduct.fat100}g
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.plusBtn, { alignSelf: 'center' }]}
                  onPress={addScannedToDraft}
                >
                  <Text style={s.plusText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={s.aiCard}>
            <View style={s.aiTopRow}>
              <View style={s.aiPill}>
                <Text style={s.aiPillText}>
                  ✨ {t('nutrition.aiAutoAnalyze')}
                </Text>
              </View>
              <View style={s.aiCameraIcon}>
                <Text style={{ fontSize: 20 }}>📷</Text>
              </View>
            </View>
            <Text style={s.aiTitle}>{t('nutrition.aiCamera')}</Text>
            <Text style={s.aiDesc}>{t('nutrition.aiCameraDesc')}</Text>
            <View style={s.aiImageWrap}>
              <Image
                source={aiPhotoUri ? { uri: aiPhotoUri } : AI_CARD_IMAGE}
                style={s.aiImage}
                resizeMode='cover'
              />
              <View style={s.aiOverlay}>
                <View style={s.aiFramePill}>
                  <Text style={s.aiFrameText}>◎ {t('nutrition.aiFrame')}</Text>
                </View>
                <View style={s.aiEstimatePill}>
                  <Text style={s.aiEstimateText}>
                    {t('nutrition.aiEstimate')}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={s.aiBtn}
              onPress={onAiPhoto}
              disabled={aiLoading}
            >
              <Text style={s.aiBtnText}>
                ⌖{' '}
                {aiLoading
                  ? t('nutrition.analyzing')
                  : t('nutrition.takePhoto')}
              </Text>
            </TouchableOpacity>
            {aiSuggestions.length > 1 && (
              <TouchableOpacity
                style={s.addAllAiBtn}
                onPress={() => {
                  aiSuggestions.forEach((it, i) =>
                    addDraftToMeal(aiToDraft(it, i), mealType),
                  );
                }}
              >
                <Text style={s.addAllAiBtnText}>
                  + {t('nutrition.addAllToDraft')}
                </Text>
              </TouchableOpacity>
            )}
            {aiSuggestions.map((it, i) => (
              <View key={i} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{it.name}</Text>
                  <Text style={s.rowSub}>
                    {it.estimatedGrams} g · {it.kcal} kcal
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.plusBtn}
                  onPress={() => addDraftToMeal(aiToDraft(it, i), mealType)}
                >
                  <Text style={s.plusText}>+</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Text style={s.section}>{t('nutrition.frequent')}</Text>
          {frequent.length === 0 ? (
            <Text style={s.hint}>{t('nutrition.noFrequent')}</Text>
          ) : (
            frequent.map((f) => (
              <View key={f.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{f.name}</Text>
                  <Text style={s.rowSub}>
                    {f.servingLabel} · {f.kcalPerServing} kcal
                  </Text>
                </View>
                <TouchableOpacity style={s.plusBtn} onPress={() => addFood(f)}>
                  <Text style={s.plusText}>+</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Text style={s.section}>{t('nutrition.savedInMeal')}</Text>
          {savedLoading ? (
            <ActivityIndicator color={theme.primaryDark} />
          ) : savedItems.length === 0 ? (
            <Text style={s.hint}>{t('nutrition.noSavedInMeal')}</Text>
          ) : (
            savedItems.map((it) => (
              <View key={it.id} style={s.row}>
                <Text style={s.savedCheck}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{it.name}</Text>
                  <Text style={s.rowSub}>
                    × {it.servings} · {round1(it.kcal)} kcal
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteSavedItem(it)}>
                  <Text style={s.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {draft.length > 0 && (
            <>
              <Text style={s.section}>{t('nutrition.draft')}</Text>
              {draft.map((it) => (
                <View key={it.key} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{it.name}</Text>
                    <Text style={s.rowSub}>
                      {it.servingLabel} × {it.servings} ·{' '}
                      {round1(it.kcalPerServing * it.servings)} kcal
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => changeServings(it.key, -0.5)}
                  >
                    <Text style={s.stepText}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => changeServings(it.key, 0.5)}
                  >
                    <Text style={s.stepText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeDraft(it.key)}>
                    <Text style={s.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <View style={s.addFoodRow}>
            <TouchableOpacity
              style={s.greenPlusBtn}
              accessibilityLabel={t('nutrition.addNewFoodLabel')}
              onPress={() => navigation.navigate('AddFood', { mealType, date })}
            >
              <Text style={s.greenPlusText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={s.totalCard}>
            <View style={s.totalHeader}>
              <Text style={s.totalLabel}>
                {t('nutrition.totalNutrients').toUpperCase()}{' '}
                {t(`nutrition.${mealType}`).toUpperCase()}
              </Text>
              <View style={s.appleCircle}>
                <Text style={{ fontSize: 20 }}>🍏</Text>
              </View>
            </View>
            <Text style={s.totalKcal}>
              <Text style={s.totalKcalBig}>+{mealTotals.kcal}</Text>
              <Text style={s.totalKcalUnit}> kcal</Text>
            </Text>
            <View style={s.barTrack}>
              {mealGrams > 0 ? (
                <>
                  <View
                    style={[
                      s.barSeg,
                      {
                        flex: mealTotals.carb / mealGrams,
                        backgroundColor: '#8FD694',
                      },
                    ]}
                  />
                  <View
                    style={[
                      s.barSeg,
                      {
                        flex: mealTotals.protein / mealGrams,
                        backgroundColor: '#A63D2F',
                      },
                    ]}
                  />
                  <View
                    style={[
                      s.barSeg,
                      {
                        flex: mealTotals.fat / mealGrams,
                        backgroundColor: '#E8B84B',
                      },
                    ]}
                  />
                </>
              ) : (
                <View
                  style={[s.barSeg, { flex: 1, backgroundColor: '#E0E0E0' }]}
                />
              )}
            </View>
            <View style={s.macroBoxes}>
              <View style={s.macroBox}>
                <Text style={[s.macroLabel, { color: '#4E8A47' }]}>
                  {t('nutrition.carbs')}
                </Text>
                <Text style={s.macroGrams}>{mealTotals.carb}g</Text>
                <Text style={s.macroPct}>{gramPct(mealTotals.carb)}%</Text>
              </View>
              <View style={s.macroBox}>
                <Text style={[s.macroLabel, { color: '#A63D2F' }]}>
                  {t('nutrition.protein')}
                </Text>
                <Text style={s.macroGrams}>{mealTotals.protein}g</Text>
                <Text style={s.macroPct}>{gramPct(mealTotals.protein)}%</Text>
              </View>
              <View style={s.macroBox}>
                <Text style={[s.macroLabel, { color: '#D98E00' }]}>
                  {t('nutrition.fat')}
                </Text>
                <Text style={s.macroGrams}>{mealTotals.fat}g</Text>
                <Text style={s.macroPct}>{gramPct(mealTotals.fat)}%</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={s.saveBtn}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={s.saveText}>
              {saving ? t('nutrition.saving') : t('nutrition.saveToLog')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

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
            <TouchableOpacity
              style={s.closeScanBtn}
              onPress={() => setScanning(false)}
            >
              <Text style={s.closeScanText}>✕ {t('nutrition.close')}</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    back: { fontSize: 30, color: theme.text, width: 32 },
    title: { fontSize: 18, fontWeight: '700', color: theme.text },
    tabs: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginVertical: 8,
    },
    tab: {
      flex: 1,
      backgroundColor: theme.cardAlt,
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: theme.primaryDark },
    tabText: { color: theme.text, fontWeight: '600', fontSize: 13 },
    tabTextActive: { color: '#fff' },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E5E5',
      borderRadius: 12,
      marginHorizontal: 16,
      paddingHorizontal: 12,
    },
    searchIcon: { fontSize: 18, marginRight: 8 },
    searchInput: { flex: 1, paddingVertical: 12, color: '#000' },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
    },
    chip: {
      backgroundColor: '#EDEDED',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipText: { color: '#333333', fontWeight: '600' },
    hint: {
      fontSize: 13,
      color: theme.muted,
      marginHorizontal: 16,
      marginBottom: 8,
      marginTop: 6,
    },
    section: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    rowTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
    rowSub: { fontSize: 13, color: theme.muted, marginTop: 2 },
    plusBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusText: {
      fontSize: 20,
      color: theme.primaryDark,
      fontWeight: '800',
      lineHeight: 22,
    },
    addFoodRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginHorizontal: 16,
      marginTop: 4,
    },
    greenPlusBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#4E8A47',
      alignItems: 'center',
      justifyContent: 'center',
    },
    greenPlusText: {
      fontSize: 26,
      color: '#fff',
      fontWeight: '800',
      lineHeight: 28,
    },
    barcodeRow: {
      flexDirection: 'row',
      gap: 8,
      marginHorizontal: 16,
      alignItems: 'center',
    },
    barcodeInput: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E5E5',
      borderRadius: 12,
      padding: 12,
      color: '#000',
    },
    barcodeIconBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E5E5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeScanBtn: {
      position: 'absolute',
      bottom: 40,
      alignSelf: 'center',
      backgroundColor: '#fff',
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    closeScanText: { fontWeight: '800' },
    scannedCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
    },
    scannedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    scannedTitle: { fontSize: 13, fontWeight: '800', color: theme.primaryDark },
    scannedName: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
      marginTop: 6,
    },
    scannedKcal: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
      marginTop: 6,
    },
    scannedMacro: { fontSize: 13, fontWeight: '700', marginTop: 2 },
    scannedBody: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiCard: {
      backgroundColor: '#F0F4FF',
      borderRadius: 24,
      padding: 16,
      margin: 16,
    },
    aiTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiPill: {
      flex: 1,
      backgroundColor: '#D6F0D6',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    aiPillText: { color: '#1B5E20', fontWeight: '700' },
    aiCameraIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 12 },
    aiDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginTop: 6 },
    aiImageWrap: {
      height: 180,
      borderRadius: 16,
      overflow: 'hidden',
      marginTop: 12,
    },
    aiImage: { width: '100%', height: 180 },
    aiOverlay: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    aiFramePill: {
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    aiFrameText: { color: '#fff', fontWeight: '600', fontSize: 12 },
    aiEstimatePill: {
      backgroundColor: '#2E7D32',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    aiEstimateText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    aiBtn: {
      backgroundColor: '#2E7D32',
      borderRadius: 999,
      padding: 16,
      alignItems: 'center',
      marginTop: 12,
    },
    aiBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    addAllAiBtn: {
      backgroundColor: '#E8F5E9',
      borderColor: '#4E8A47',
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    addAllAiBtnText: {
      color: '#2E7D32',
      fontWeight: '700',
      fontSize: 14,
    },
    savedCheck: { fontSize: 16, color: '#4E8A47', fontWeight: '800' },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { fontSize: 18, color: theme.text, fontWeight: '700' },
    removeText: { fontSize: 16, color: '#C62828', paddingHorizontal: 4 },
    totalCard: {
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 16,
      margin: 16,
    },
    totalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#666',
      letterSpacing: 0.5,
    },
    appleCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#D6F0D6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    totalKcal: { marginTop: 4 },
    totalKcalBig: { fontSize: 36, fontWeight: '800', color: '#1B5E20' },
    totalKcalUnit: { fontSize: 16, fontWeight: '700', color: '#333' },
    barTrack: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      marginTop: 12,
    },
    barSeg: { height: 10 },
    macroBoxes: { flexDirection: 'row', gap: 8, marginTop: 12 },
    macroBox: {
      flex: 1,
      backgroundColor: '#EEF1FF',
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    macroLabel: { fontSize: 14, fontWeight: '800' },
    macroGrams: {
      fontSize: 18,
      fontWeight: '800',
      color: '#111',
      marginTop: 4,
    },
    macroPct: { fontSize: 13, color: '#666', marginTop: 2 },
    saveBtn: {
      backgroundColor: theme.primaryDark,
      borderRadius: 999,
      padding: 16,
      marginHorizontal: 16,
      alignItems: 'center',
    },
    saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  });
}
