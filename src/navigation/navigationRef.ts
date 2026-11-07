import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function getActiveRouteName(state: any): string | null {
  if (!state || !state.routes || state.routes.length === 0) return null;
  const route = state.routes[state.index];
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}
