import * as React from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../lib/trpc';

export default function HomeScreen() {
  const router = useRouter();
  const { data: categories, isLoading } = trpc.fleet.getCategories.useQuery();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CarRental Staff</Text>
      <Text style={styles.subtitle}>Fleet Management</Text>

      <View style={styles.list}>
        {categories?.map((cat) => (
          <View key={cat.id} style={styles.item}>
            <Text style={styles.itemTitle}>{cat.name}</Text>
            <Text style={styles.itemCount}>{cat._count?.vehicles || 0} vehicles</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title="Check-in Vehicle" onPress={() => router.push('/checkin')} />
        <Button title="Vehicle Inspection" onPress={() => router.push('/inspection')} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24 },
  list: { marginBottom: 24 },
  item: { flexDirection: 'row', justifyContent: 'spaceBetween', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  itemCount: { fontSize: 14, color: '#666' },
  actions: { gap: 12 },
});