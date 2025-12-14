import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';

type StudyGroup = {
  id: string;
  name: string;
  memberCount: number;
  description: string;
};

// ⚡ Firestore에 기본 테스트 데이터를 자동 추가하는 함수
const seedDefaultGroups = async () => {
  try {
    const colRef = firestore().collection('studyGroups');

    // 이미 데이터가 있다면 추가하지 않음
    const snapshot = await colRef.limit(1).get();
    if (!snapshot.empty) {
      return;
    }

    await colRef.doc('react-native-study').set({
      name: 'React Native 정복 스터디',
      memberCount: 5,
      description: '리액트 네이티브 공부하는 그룹',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    await colRef.doc('algorithm-master').set({
      name: '알고리즘 마스터',
      memberCount: 8,
      description: '알고리즘 문제 풀이 스터디',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    await colRef.doc('morning-wakeup').set({
      name: '오전 기상 인증 그룹',
      memberCount: 12,
      description: '아침 기상 인증 스터디',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    await colRef.doc('firebase-expert').set({
      name: 'Firebase 전문가 그룹',
      memberCount: 4,
      description: 'Firebase 심화 학습 스터디',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ 기본 스터디 그룹 데이터 생성 완료');
  } catch (e) {
    console.error('❌ 기본 데이터 생성 실패:', e);
  }
};

export default function StudyGroupsScreen({ navigation }: any) {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // 새 그룹 생성용 상태
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      // 먼저 테스트 데이터를 넣고
      await seedDefaultGroups();

      // Firestore 실시간 구독
      unsubscribe = firestore()
        .collection('studyGroups')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          snapshot => {
            const list = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: (data.name as string) ?? '이름 없음',
                memberCount: (data.memberCount as number) ?? 0,
                description: (data.description as string) ?? '',
              };
            });

            setGroups(list);
            setLoading(false);
          },
          error => {
            console.error('🔥 그룹 목록 로딩 실패:', error);
            setLoading(false);
          },
        );
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleCreateGroup = async () => {
    const name = newName.trim();
    const desc = newDesc.trim();

    if (!name) {
      Alert.alert('오류', '그룹 이름을 입력해주세요.');
      return;
    }

    try {
      await firestore().collection('studyGroups').add({
        name,
        memberCount: 1, // 기본값: 생성자 1명
        description: desc,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      setNewName('');
      setNewDesc('');
      setShowForm(false);

      Alert.alert('완료', '새 그룹이 생성되었습니다.');
    } catch (e) {
      console.error('❌ 그룹 생성 실패:', e);
      Alert.alert('오류', '그룹 생성에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8F00" />
        <Text style={{ marginTop: 8 }}>그룹을 불러오는 중...</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: StudyGroup }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() =>
        navigation.navigate('GroupDetail', {
          groupId: item.id,
          groupName: item.name,
          memberCount: item.memberCount,
          description: item.description,
        })
      }
    >
      <View style={styles.iconWrapper}>
        <Icon name="groups" size={32} color="#F4A261" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.memberCount}>멤버: {item.memberCount}명</Text>
        {!!item.description && (
          <Text style={styles.groupDesc} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>

      <Icon name="chevron-right" size={28} color="#999" />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>스터디 그룹</Text>

        <FlatList
          data={groups}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 16 }}
        />

        {/* 새 그룹 만들기 / 취소 버튼 */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowForm(prev => !prev)}
        >
          <Text style={styles.createButtonText}>
            {showForm ? '새 그룹 만들기 취소' : '새 그룹 만들기'}
          </Text>
        </TouchableOpacity>

        {/* 새 그룹 입력 폼 */}
        {showForm && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>새 그룹 생성</Text>
            <TextInput
              style={styles.input}
              placeholder="그룹 이름"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="그룹 설명 (선택)"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleCreateGroup}>
              <Text style={styles.submitButtonText}>생성</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// 스타일
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupName: { fontSize: 18, fontWeight: 'bold' },
  memberCount: { fontSize: 14, color: '#777', marginTop: 2 },
  groupDesc: { fontSize: 13, color: '#999', marginTop: 2 },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 4 },
  createButton: {
    marginTop: 8,
    backgroundColor: '#FF8F00',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFF7E6',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    fontSize: 14,
  },
  submitButton: {
    marginTop: 4,
    backgroundColor: '#FF8F00',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});
