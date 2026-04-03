import { Tabs } from 'one'

export function TabsLayout() {
  return (
    <Tabs
      initialRouteName="talks"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="talks" />
      <Tabs.Screen name="settings" />
    </Tabs>
  )
}
