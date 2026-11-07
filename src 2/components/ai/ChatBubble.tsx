import React from 'react';
import { Text, View } from 'react-native';
import type { ThemePalette } from '../../context/SettingsContext';
import { s } from '../../features/ai/screens/AiChatScreen.styles';

export function ChatBubble({
  role,
  text,
  theme,
}: {
  role: 'user' | 'assistant';
  text: string;
  theme: ThemePalette;
}) {
  const mine = role === 'user';
  return (
    <View style={[s.bubbleRow, mine ? s.bubbleRowMine : s.bubbleRowTheir]}>
      <View
        style={[
          s.bubble,
          mine
            ? { backgroundColor: theme.primaryDark }
            : { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        ]}
      >
        <Text style={[s.bubbleText, { color: mine ? '#fff' : theme.text }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}
