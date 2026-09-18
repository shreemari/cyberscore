import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

// Bottom tab bar: STATUS · ANALYTICS · CHAT · PROFILE.
// "CHAT" is the AI Insights screen — Claude-powered benchmarking & advice.
export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          height: 82,
          paddingTop: 10,
          paddingBottom: 18,
        },
        tabBarActiveTintColor: colors.brand[400],
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'STATUS',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'ANALYTICS',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'CHAT',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="assessment" options={{ href: null }} />
      <Tabs.Screen
        name="kpi/[id]"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen name="scorecard" options={{ href: null }} />
      <Tabs.Screen
        name="results"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      {/* Admin-only: Team management. Hidden from the bar; reached from the
          dashboard's "Manage team" CTA which renders only for ADMIN of an
          ENTERPRISE org. */}
      <Tabs.Screen name="team" options={{ href: null }} />
    </Tabs>
  );
}
