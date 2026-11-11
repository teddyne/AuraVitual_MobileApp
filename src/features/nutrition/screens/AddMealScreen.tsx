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
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppIcon } from '../../../components/ui/AppIcon';
import { useSubscription } from '../../../context/SubscriptionContext';
import { useToast } from '../../../components/NotificationToast';
import { aiErrorMessageKey } from '../../../api/aiClient';
import {
  aiToDraft,
  analyzeMealPhoto,
  deleteMealItem,
  draftTotals,
  fetchBarcodeProduct,
  FREE_AI_PHOTO_DAILY_LIMIT,
  getFrequentFoods,
  getNutritionDay,
  loadAiPhotoUsage,
  recordAiPhotoUsage,
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
} from '../../../api/nutritionApi';
import {
  EMPTY_DRAFTS,
  MACRO_DOT_COLORS,
  MEAL_ICONS,
  MEAL_ORDER,
  PRESET_SUGGESTIONS,
  isExcludedSuggestion,
} from '../constants';
import { defaultMealType, round1, toNum } from '../../../utils/nutrition/nutritionFormat';
import { BarcodeIcon } from '../../../components/nutrition/BarcodeIcon';
import { makeStyles } from './AddMealScreen.styles';

const AI_CARD_IMAGE = require('../../../../assets/images/meal.jpg');

export default function AddMealScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { theme, t } = useSettings();
  const { aiUnlimited } = useSubscription();
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
  const { showToast } = useToast();
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(
    null,
  );
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPhotoUri, setAiPhotoUri] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionItem[]>([]);
  // Lượt AI Camera đã dùng hôm nay (Free: 3 ảnh/ngày, Pro/Family: không giới hạn).
  const [aiPhotoUsage, setAiPhotoUsage] = useState(0);
  const aiPhotoLimitReached =
    !aiUnlimited && aiPhotoUsage >= FREE_AI_PHOTO_DAILY_LIMIT;

  const loadAiUsage = useCallback(async () => {
    try {
      setAiPhotoUsage(await loadAiPhotoUsage());
    } catch {
      setAiPhotoUsage(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAiUsage();
    }, [loadAiUsage]),
  );
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
    showToast({
      title: t('nutrition.scannedAddedTitle'),
      body: t('nutrition.scannedAddedBody', { name: scannedProduct.name }),
    });
    setScannedProduct(null);
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
        throw new Error(t('nutrition.imageProcessFailed'));
      }

      const items = await analyzeMealPhoto(base64Data);
      setAiSuggestions(items);
      // Chỉ ghi nhận lượt khi phân tích thành công (lỗi thì không trừ lượt).
      if (!aiUnlimited) setAiPhotoUsage(await recordAiPhotoUsage());
      if (items.length === 0) {
        Alert.alert(t('nutrition.aiCamera'), t('nutrition.aiEmpty'));
      }
    } catch (e: any) {
      // Khong hien nguyen van loi cua Gemini (chuoi JSON dai nhu anh loi
      // 404). Chi hien cau tieng Viet/Anh ngan da dich san theo ma loi.
      const code = typeof e?.message === 'string' ? e.message : 'ai_failed';
      Alert.alert(t('nutrition.aiCamera'), t(aiErrorMessageKey(code)));
    } finally {
      setAiLoading(false);
    }
  };

  const onAiPhoto = () => {
    // Free hết 3 ảnh/ngày thì chặn ngay, mời nâng cấp Pro (không mở camera).
    if (aiPhotoLimitReached) {
      Alert.alert(
        t('nutrition.aiCameraLimitTitle'),
        t('nutrition.aiCameraLimitBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('subscription.viewPlans'),
            onPress: () => navigation.navigate('Plans'),
          },
        ],
      );
      return;
    }
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
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AppHeader title={t('nutrition.title')} withTopInset={false} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={s.tabs}
          >
            {MEAL_ORDER.map((type) => (
              <TouchableOpacity
                key={type}
                style={[s.tab, mealType === type && s.tabActive]}
                onPress={() => setMealType(type)}
              >
                <View style={s.tabContent}>
                  <AppIcon
                    name={MEAL_ICONS[type]}
                    size={18}
                    color={mealType === type ? '#fff' : theme.text}
                  />
                  <Text style={[s.tabText, mealType === type && s.tabTextActive]}>
                    {t(`nutrition.${type}`)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.searchBox}>
            <AppIcon name='search-outline' size={20} tone='muted' />
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
            {!aiUnlimited && (
              <Text style={s.hint}>
                {t('nutrition.aiCameraFreeLeft', {
                  count: Math.max(
                    0,
                    FREE_AI_PHOTO_DAILY_LIMIT - aiPhotoUsage,
                  ),
                })}
              </Text>
            )}
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
