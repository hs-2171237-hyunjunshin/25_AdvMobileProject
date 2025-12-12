// components/groups/GroupDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

type RootStackParamList = {
  GroupDetail: {
    groupId: string;
    groupName: string;
    memberCount: number;
    description?: string;
  };
};

type Post = {
  id: string;
  author: string;
  content: string;
  createdAtText: string;
  hasFile?: boolean;
};

type Schedule = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: '시험' | '과제' | '모임';
};

// 일정은 일단 더미 데이터 유지
const SAMPLE_SCHEDULES: Schedule[] = [
  {
    id: 's1',
    title: '주간 테스트',
    date: '1월 28일',
    time: '19:00',
    type: '시험',
  },
  {
    id: 's2',
    title: '과제 제출 마감',
    date: '1월 30일',
    time: '23:59',
    type: '과제',
  },
  {
    id: 's3',
    title: '스터디 모임',
    date: '2월 3일',
    time: '14:00',
    type: '모임',
  },
];

// 🔹 그룹별 기본 게시글 자동 생성 (최초 1회)
const seedDefaultPostsForGroup = async (groupId: string, groupName: string) => {
  try {
    const colRef = firestore()
      .collection('studyGroups')
      .doc(groupId)
      .collection('posts');

    const snapshot = await colRef.limit(1).get();
    if (!snapshot.empty) {
      // 이미 게시글이 1개 이상 있으면 안 넣음
      return;
    }

    await colRef.add({
      author: '관리자',
      content: `${groupName}의 첫 번째 공지 게시글입니다. 함께 열심히 공부해봐요!`,
      hasFile: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    await colRef.add({
      author: '스터디장',
      content: '이번 주 목표와 학습 분량을 댓글로 남겨주세요.',
      hasFile: true,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ 그룹(${groupId}) 기본 게시글 생성 완료`);
  } catch (e) {
    console.error('❌ 기본 게시글 생성 실패:', e);
  }
};

const GroupDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();
  const { groupId, groupName, memberCount, description } = route.params;

  const [tab, setTab] = useState<'posts' | 'schedules'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // 새 게시글 입력용 상태
  const [showPostForm, setShowPostForm] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      // 1) 기본 게시글 자동 생성 (없을 때만)
      await seedDefaultPostsForGroup(groupId, groupName);

      // 2) 해당 그룹의 posts 서브컬렉션 실시간 구독
      unsubscribe = firestore()
        .collection('studyGroups')
        .doc(groupId)
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          snapshot => {
            const list: Post[] = snapshot.docs.map(doc => {
              const data = doc.data();
              const createdAt = data.createdAt;

              let createdAtText = '';
              if (createdAt && createdAt.toDate) {
                const d: Date = createdAt.toDate();
                createdAtText = `${d.getMonth() + 1}월 ${d.getDate()}일`;
              } else {
                createdAtText = '방금 전';
              }

              return {
                id: doc.id,
                author: (data.author as string) ?? '작성자',
                content: (data.content as string) ?? '',
                hasFile: data.hasFile as boolean | undefined,
                createdAtText,
              };
            });

            setPosts(list);
            setPostsLoading(false);
          },
          error => {
            console.error('🔥 게시글 로딩 실패:', error);
            setPostsLoading(false);
          },
        );
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId, groupName]);

  const handleCreatePost = async () => {
    const content = newPostContent.trim();
    if (!content) {
      Alert.alert('오류', '게시글 내용을 입력해주세요.');
      return;
    }

    try {
      const user = auth().currentUser;
      const email = user?.email ?? '익명';
      const authorName = email.split('@')[0];

      await firestore()
        .collection('studyGroups')
        .doc(groupId)
        .collection('posts')
        .add({
          author: authorName,
          content,
          hasFile: false, // 지금은 파일 기능 없으니까 false
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      setNewPostContent('');
      setShowPostForm(false);
      Alert.alert('완료', '게시글이 등록되었습니다.');
    } catch (e) {
      console.error('❌ 게시글 등록 실패:', e);
      Alert.alert('오류', '게시글 등록에 실패했습니다.');
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAuthorRow}>
          <Icon name="person" size={18} color="#6B7280" />
          <Text style={styles.postAuthor}>{item.author}</Text>
        </View>
        <Text style={styles.postTime}>{item.createdAtText}</Text>
      </View>
      <Text style={styles.postContent}>{item.content}</Text>
      {item.hasFile && (
        <View style={styles.fileBadge}>
          <Icon name="attach-file" size={14} color="#4C51BF" />
          <Text style={styles.fileBadgeText}>파일 첨부</Text>
        </View>
      )}
    </View>
  );

  const renderSchedule = ({ item }: { item: Schedule }) => (
    <View style={styles.scheduleCard}>
      <View style={styles.scheduleDateBox}>
        <Text style={styles.scheduleDate}>{item.date}</Text>
        <Text style={styles.scheduleTime}>{item.time}</Text>
      </View>
      <View style={styles.scheduleBody}>
        <View style={styles.scheduleTitleRow}>
          <Text style={styles.scheduleTitle}>{item.title}</Text>
          <View style={styles.scheduleTag}>
            <Text style={styles.scheduleTagText}>{item.type}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 상단 그룹 정보 영역 */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>
            {groupName.charAt(0)}
          </Text>
        </View>
        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>{groupName}</Text>
          {!!description && (
            <Text style={styles.headerDesc} numberOfLines={2}>
              {description}
            </Text>
          )}
          <Text style={styles.headerMeta}>멤버 {memberCount}명</Text>
        </View>
      </View>

      {/* 탭 버튼 (게시글 / 일정) */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'posts' && styles.tabButtonActive]}
          onPress={() => setTab('posts')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'posts' && styles.tabTextActive,
            ]}
          >
            게시글
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            tab === 'schedules' && styles.tabButtonActive,
          ]}
          onPress={() => setTab('schedules')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'schedules' && styles.tabTextActive,
            ]}
          >
            일정
          </Text>
        </TouchableOpacity>
      </View>

      {/* 상단 액션 버튼 (게시글 탭일 때만 새 글 폼 토글) */}
      <View style={styles.actionRow}>
        {tab === 'posts' ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowPostForm(prev => !prev)}
          >
            <Text style={styles.primaryButtonText}>
              {showPostForm ? '작성 취소' : '새 게시글 작성'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.primaryButtonDisabled}>
            <Text style={styles.primaryButtonText}>새 일정 추가 (추후 구현)</Text>
          </View>
        )}
      </View>

      {/* 게시글 입력 폼 (게시글 탭 + showPostForm=true 일 때만) */}
      {tab === 'posts' && showPostForm && (
        <View style={styles.postFormContainer}>
          <Text style={styles.postFormTitle}>새 게시글</Text>
          <TextInput
            style={styles.postInput}
            placeholder="내용을 입력하세요"
            value={newPostContent}
            onChangeText={setNewPostContent}
            multiline
          />
          <TouchableOpacity style={styles.postSubmitButton} onPress={handleCreatePost}>
            <Text style={styles.postSubmitButtonText}>등록</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 콘텐츠 영역 */}
      {tab === 'posts' ? (
        postsLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#FF8F00" />
            <Text style={{ marginTop: 6, color: '#6B7280' }}>게시글을 불러오는 중...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.centered}>
            <Text style={{ color: '#9CA3AF' }}>아직 게시글이 없습니다.</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={renderPost}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        <FlatList
          data={SAMPLE_SCHEDULES}
          keyExtractor={item => item.id}
          renderItem={renderSchedule}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </KeyboardAvoidingView>
  );
};

export default GroupDetailScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F8',
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF8F00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerIconText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTextBox: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerDesc: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  headerMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: '#FFE8C2',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FF8F00',
  },
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  primaryButton: {
    backgroundColor: '#FF8F00',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAuthor: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  postTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  postContent: {
    marginTop: 6,
    fontSize: 14,
    color: '#374151',
  },
  fileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  fileBadgeText: {
    marginLeft: 3,
    fontSize: 11,
    color: '#4C51BF',
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  scheduleDateBox: {
    width: 90,
    marginRight: 12,
  },
  scheduleDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  scheduleTime: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  scheduleBody: {
    flex: 1,
    justifyContent: 'center',
  },
  scheduleTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  scheduleTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E5F3FF',
  },
  scheduleTagText: {
    fontSize: 11,
    color: '#1D4ED8',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  postFormContainer: {
    backgroundColor: '#FFF7E6',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    padding: 10,
  },
  postFormTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  postInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  postSubmitButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#FF8F00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  postSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
