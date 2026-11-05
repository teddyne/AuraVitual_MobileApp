import type { Profile } from '../../../lib/auravitalApi';
import { translate } from '../../../i18n/locale';

// Tach nguyen van tu HomeScreen.tsx: ten hien thi o loi chao.
export function resolveGreetingName(profile: Profile, user: any): string {
  const fromProfile = profile.display_name?.trim() ?? '';
  if (fromProfile && !fromProfile.includes('@')) return fromProfile;
  const fromAuth = user?.name?.trim() ?? '';
  const emailPrefix = user?.email?.split('@')[0] ?? '';
  if (fromAuth && !fromAuth.includes('@') && fromAuth !== emailPrefix)
    return fromAuth;
  return translate('home.you');
}
