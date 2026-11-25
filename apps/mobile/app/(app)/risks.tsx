import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { colors } from '@/theme/colors';

type Treatment = 'MITIGATE' | 'AVOID' | 'TRANSFER' | 'ACCEPT';
type Status = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export default function RiskRegister() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['governance-risks'],
    queryFn: () => api.risks.list(),
  });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [treatment, setTreatment] = useState<Treatment>('MITIGATE');
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim() || description.trim().length < 10) {
        throw new Error('Add a risk title and a description of at least 10 characters.');
      }
      let acceptedUntil: string | null = null;
      if (treatment === 'ACCEPT') {
        if (reason.trim().length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
          throw new Error('Risk acceptance needs a justification and expiry (YYYY-MM-DD).');
        }
        const date = new Date(`${expiry}T23:59:59.000Z`);
        if (Number.isNaN(date.valueOf()) || date <= new Date()) {
          throw new Error('Enter a future acceptance expiration date.');
        }
        acceptedUntil = date.toISOString();
      }
      return api.risks.create({
        title: title.trim(),
        description: description.trim(),
        likelihood,
        impact,
        treatment,
        status: 'OPEN',
        exceptionReason: treatment === 'ACCEPT' ? reason.trim() : null,
        acceptedUntil,
      });
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setReason('');
      setExpiry('');
      setTreatment('MITIGATE');
      void qc.invalidateQueries({ queryKey: ['governance-risks'] });
      Alert.alert('Risk saved', 'The risk is now in the organisation register.');
    },
    onError: (error: Error) => Alert.alert('Risk not saved', error.message),
  });

  const update = useMutation({
    mutationFn: (args: { risk: NonNullable<typeof data>['items'][number]; status: Status }) =>
      api.risks.update({
        id: args.risk.id,
        title: args.risk.title,
        description: args.risk.description,
        likelihood: args.risk.likelihood,
        impact: args.risk.impact,
        treatment: args.risk.treatment,
        status: args.status,
        ownerId: args.risk.ownerId,
        dueDate: args.risk.dueDate,
        exceptionReason: args.risk.exceptionReason,
        acceptedUntil: args.risk.acceptedUntil,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['governance-risks'] }); },
    onError: (error: Error) => Alert.alert('Could not update risk', error.message),
  });

  const fieldStyle = {
    color: colors.text.primary,
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  } as const;

  const scoreLabel = (value: number) => value >= 15 ? 'HIGH' : value >= 7 ? 'MEDIUM' : 'LOW';

  return (
    <Screen glow>
      <TopBar title="RISK REGISTER" showBack />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.text.secondary, marginBottom: 14 }}>
          Record operational and cybersecurity risks, their treatments, and formal risk acceptance.
        </Text>
        <Card>
          <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 17, marginBottom: 12 }}>
            Register a risk
          </Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Risk title"
            placeholderTextColor={colors.text.muted} style={{ ...fieldStyle, marginBottom: 10 }} />
          <TextInput value={description} onChangeText={setDescription} multiline
            placeholder="Describe the risk and affected assets"
            placeholderTextColor={colors.text.muted}
            style={{ ...fieldStyle, minHeight: 90, textAlignVertical: 'top', marginBottom: 12 }} />

          {([
            ['Likelihood', likelihood, setLikelihood],
            ['Impact', impact, setImpact],
          ] as const).map(([label, value, setter]) => (
            <View key={label} style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.text.secondary, marginBottom: 6 }}>{label} (1–5)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Pressable key={n} onPress={() => setter(n)} accessibilityRole="button"
                    style={{ flex: 1, borderRadius: 8, paddingVertical: 10,
                      backgroundColor: value === n ? colors.brand[500] : colors.bg.elevated }}>
                    <Text style={{ color: colors.text.primary, textAlign: 'center', fontWeight: '700' }}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <Text style={{ color: colors.text.primary, marginBottom: 12 }}>
            Inherent risk: {likelihood * impact}/25 · {scoreLabel(likelihood * impact)}
          </Text>

          <Text style={{ color: colors.text.secondary, marginBottom: 6 }}>Treatment</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {(['MITIGATE', 'AVOID', 'TRANSFER', 'ACCEPT'] as Treatment[]).map(choice => (
              <Pressable key={choice} onPress={() => setTreatment(choice)} accessibilityRole="button"
                style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
                  backgroundColor: treatment === choice ? colors.brand[500] : colors.bg.elevated }}>
                <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 12 }}>{choice}</Text>
              </Pressable>
            ))}
          </View>
          {treatment === 'ACCEPT' && (
            <View style={{ gap: 9, marginBottom: 12 }}>
              <Text style={{ color: colors.text.secondary }}>
                Accepted risks must have a written justification and a future expiry date.
              </Text>
              <TextInput style={fieldStyle} value={reason} onChangeText={setReason}
                placeholder="Risk acceptance justification"
                placeholderTextColor={colors.text.muted} multiline />
              <TextInput style={fieldStyle} value={expiry} onChangeText={setExpiry}
                placeholder="Expiry YYYY-MM-DD" placeholderTextColor={colors.text.muted} />
            </View>
          )}
          <Button label="Save risk" onPress={() => create.mutate()} loading={create.isPending} />
        </Card>

        <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 18, marginTop: 22, marginBottom: 12 }}>
          Organisation risks ({data?.items.length ?? 0})
        </Text>
        {isLoading && <Text style={{ color: colors.text.secondary }}>Loading risk register…</Text>}
        {isError && <Button variant="outline" label="Retry loading risks" onPress={() => { void refetch(); }} />}
        {(data?.items ?? []).map(risk => (
          <Card key={risk.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Text style={{ color: colors.text.primary, fontWeight: '800', flex: 1 }}>{risk.title}</Text>
              <Text style={{ color: colors.brand[400], fontWeight: '800' }}>
                {risk.riskScore}/25
              </Text>
            </View>
            <Text style={{ color: colors.text.secondary, marginTop: 6 }}>{risk.description}</Text>
            <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 8 }}>
              {risk.treatment} · {risk.status} · {scoreLabel(risk.riskScore)}
            </Text>
            {risk.treatment === 'ACCEPT' && (
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 5 }}>
                Acceptance: {risk.exceptionReason || 'Not recorded'}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {(['OPEN', 'IN_PROGRESS', 'CLOSED'] as Status[]).map(status => (
                <Pressable key={status}
                  disabled={update.isPending || status === risk.status}
                  onPress={() => update.mutate({ risk, status })}
                  style={{ flex: 1, padding: 9, borderRadius: 8,
                    backgroundColor: risk.status === status ? colors.brand[500] : colors.bg.elevated }}>
                  <Text style={{ color: colors.text.primary, textAlign: 'center', fontSize: 10 }}>
                    {status.replace('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
