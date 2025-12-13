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
  Image,
  Modal,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Dialog from 'react-native-dialog'
import { Calendar, DateData } from 'react-native-calendars';
import { pick } from '@react-native-documents/picker';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';

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
  fileUrl?: string;
  fileName?: string;
  imageUrl?: string;
};


type GroupDetailNavigationProp = StackNavigationProp<RootStackParamList, 'GroupDetail'>;

// 일정은 일단 더미 데이터 유지


// 🔹 그룹별 기본 게시글 자동 생성 (최초 1회)
const seedDefaultPostsForGroup = async (groupId: string, groupName: string) => {
  const colRef = firestore().collection('studyGroups').doc(groupId).collection('posts');
  const snapshot = await colRef.limit(1).get();
  if (!snapshot.empty) return; // 게시글이 이미 있으면 생성 안함

  try {
    await colRef.add({
      author: '관리자',
      content: `${groupName} 그룹에 오신 것을 환영합니다! 함께 열심히 공부해봐요!`,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('❌ 기본 게시글 생성 실패:', e);
  }
};

type FileObject = Awaited<ReturnType<typeof pick>>[0];

const GroupDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();
  const { groupId, groupName, memberCount, description } = route.params;

  const [tab, setTab] = useState<'posts' | 'schedules'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // 새 게시글 입력용 상태
  const [showPostForm, setShowPostForm] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [attachedFile, setAttachedFile] = useState<FileObject | null>(null);
  const [attachedImage, setAttachedImage] = useState<ImagePickerResponse['assets'][0] | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const navigation = useNavigation<GroupDetailNavigationProp>();
  const currentUser = auth().currentUser;
  const currentUserId = currentUser?.uid;

  const [isMember, setIsMember] = useState(false);
  const [isProcessingJoin, setIsProcessingJoin] = useState(false);

  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleDialogVisible, setScheduleDialogVisible] = useState(false);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const onDayPress = (day: DateData) => {
    setNewScheduleDate(day.dateString); // YYYY-MM-DD 형식으로 상태 업데이트
    setIsCalendarVisible(false); // 달력 모달 닫기
  };
  const handleSelectImage = () => {
          if (attachedFile) { Alert.alert("첨부파일 중복", "이미 파일이 첨부되어 있습니다. 이미지와 파일은 동시에 첨부할 수 없습니다."); return; }
          launchImageLibrary({ mediaType: 'photo' }, (response) => {
              if (response.didCancel || response.errorCode) {
                  console.log('Image picker closed or failed.');
              } else if (response.assets && response.assets.length > 0) {
                  setAttachedImage(response.assets[0]); // asset 객체 전체를 저장
              }
          });
      };
  const handleSelectFile = async () => {
          if (attachedImage) { Alert.alert("첨부파일 중복", "이미지가 첨부되어 있습니다. 이미지와 파일은 동시에 첨부할 수 없습니다."); return; }
          try {
              const [result] = await pick({
                  type: 'public.item',
              });
              setAttachedFile(result);
          } catch (err) {
              console.log('Document picker closed or failed', err);
          }
      };
  useEffect(() => {

    seedDefaultPostsForGroup(groupId, groupName);

    const postSubscriber = firestore()
        .collection('studyGroups').doc(groupId).collection('posts')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
          const postList = snapshot.docs.map(doc => {
            const data = doc.data();
            const createdAt = data.createdAt;
            return {
              id: doc.id,
              author: data.author || '작성자',
              content: data.content || '',
              createdAtText: createdAt?.toDate() ? `${createdAt.toDate().getMonth() + 1}월 ${createdAt.toDate().getDate()}일` : '방금 전',
              imageUrl: data.imageUrl,
              fileUrl: data.fileUrl,
              fileName: data.fileName,
            };
          });
          setPosts(postList);
          setPostsLoading(false);
        });

    const scheduleSubscriber = firestore()
        .collection('studyGroups').doc(groupId).collection('schedules')
        .orderBy('date', 'asc')
        .onSnapshot(snapshot => {
          const scheduleList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSchedules(scheduleList);
        });

    const membershipSubscriber = firestore().collection('studyGroups').doc(groupId)
        .onSnapshot(doc => {
          const members = doc.data()?.members || [];
          setIsMember(members.includes(currentUserId));
        });

    return () => {
      postSubscriber();
      scheduleSubscriber();
      membershipSubscriber();
    };
  }, [groupId, groupName, currentUserId]);

  const handleJoinGroup = async () => {
    if (!currentUserId) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }
    if (isProcessingJoin) return;
    setIsProcessingJoin(true);

    const groupDocRef = firestore().collection('studyGroups').doc(groupId);
    const userDocRef = firestore().collection('users').doc(currentUserId);

    try {
      // 트랜잭션을 사용하여 데이터 일관성 보장
      await firestore().runTransaction(async transaction => {
        // 그룹 문서에 멤버 추가
        transaction.update(groupDocRef, {
          members: firestore.FieldValue.arrayUnion(currentUserId),
          memberCount: firestore.FieldValue.increment(1)
        });
        // 사용자 문서에 가입 그룹 ID 추가
        transaction.update(userDocRef, {
          joinedGroups: firestore.FieldValue.arrayUnion(groupId)
        });
      });
      Alert.alert('완료', `${groupName} 그룹에 가입되었습니다.`);
    } catch (error) {
      console.error('❌ 그룹 가입 실패:', error);
      Alert.alert('오류', '그룹 가입에 실패했습니다.');
    } finally {
      setIsProcessingJoin(false);
    }
  };

  const canWritePost = isMember;



  const handleCreatePost = async () => {
    const content = newPostContent.trim();
    if (!content && !attachedImage && !attachedFile) {
      Alert.alert('오류', '게시글 내용이나 첨부파일을 추가해주세요.');
      return;
    }
    if (!isMember) {
      Alert.alert('권한 없음', '그룹 멤버만 게시글을 작성할 수 있습니다.');
      return;
    }
    setIsUploading(true);

    let imageURL: string | null = null;
    let fileURL: string | null = null;
    let fileName: string | null = null;

    try {
      const uploadPath = `group_attachments/${groupId}/${Date.now()}`;

      // 1. 이미지 또는 파일 업로드
      if (attachedImage?.uri) {
                      const reference = storage().ref(`${uploadPath}_${attachedImage.fileName}`);
                      await reference.putFile(attachedImage.uri);
                      imageURL = await reference.getDownloadURL();
      } else if (attachedFile?.uri) {
                      const reference = storage().ref(`${uploadPath}_${attachedFile.name}`);
                      await reference.putFile(attachedFile.uri);
                      fileURL = await reference.getDownloadURL();
                      fileName = attachedFile.name;
      }

      // 2. Firestore에 게시글 데이터 저장
      const authorName = currentUser?.email?.split('@')[0] ?? '익명';
      await firestore().collection('studyGroups').doc(groupId).collection('posts').add({
        author: authorName,
        content,
        imageUrl: imageURL,
        fileUrl: fileURL,
        fileName: fileName,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // 폼 초기화
      setNewPostContent('');
      setAttachedImage(null);
      setAttachedFile(null);
      setShowPostForm(false);
    } catch (e) {
      console.error('❌ 게시글 등록 실패:', e);
      Alert.alert('오류', '게시글 등록에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!newScheduleTitle.trim() || !newScheduleDate.trim()) {
      Alert.alert('입력 오류', '일정 제목과 날짜를 모두 입력해주세요.');
      return;
    }
    // YYYY-MM-DD 형식인지 간단하게 검증합니다.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newScheduleDate)) {
      Alert.alert('형식 오류', '날짜는 YYYY-MM-DD 형식으로 입력해주세요.\n(예: 2025-12-25)');
      return;
    }

    try {
      await firestore()
          .collection('studyGroups').doc(groupId)
          .collection('schedules').add({
            title: newScheduleTitle,
            date: newScheduleDate,
            createdBy: currentUserId,
            authorName: currentUser?.displayName || currentUser?.email,
            createdAt: firestore.FieldValue.serverTimestamp(),
          });

      Alert.alert('성공', '새로운 그룹 일정이 추가되었습니다.');
      setScheduleDialogVisible(false); // 다이얼로그 닫기
      setNewScheduleTitle(''); // 입력 필드 초기화
      setNewScheduleDate('');
    } catch (error) {
      console.error('❌ 그룹 일정 생성 실패:', error);
      Alert.alert('오류', '일정 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const renderSchedule = ({ item }: { item: any }) => (
      <View style={styles.scheduleCard}>
        <View style={styles.scheduleDateContainer}>
          <Text style={styles.scheduleDateText}>{item.date}</Text>
        </View>
        <View style={styles.scheduleContentContainer}>
          <Text style={styles.scheduleTitle}>{item.title}</Text>
          <Text style={styles.scheduleAuthor}>작성자: {item.authorName}</Text>
        </View>
      </View>
  );

  const renderPost = ({ item }: { item: Post }) => (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.postAuthorRow}>
            <Icon name="person" size={18} color="#6B7280" />
            <Text style={styles.postAuthor}>{item.author}</Text>
          </View>
          <Text style={styles.postTime}>{item.createdAtText}</Text>
        </View>
        {!!item.content && <Text style={styles.postContent}>{item.content}</Text>}
        {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
        )}
        {item.fileUrl && (
            <TouchableOpacity style={styles.fileAttachment}>
              <Icon name="attach-file" size={20} color="#4B5563" />
              <Text style={styles.fileName} numberOfLines={1}>{item.fileName || '첨부 파일'}</Text>
            </TouchableOpacity>
        )}
      </View>
  );


  return (
      // KeyboardAvoidingView 바로 아래에 모든 것을 감싸는 최상위 View 추가
      <View style={styles.screen}>
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} // Android는 behavior를 주지 않아야 더 자연스러울 때가 많음
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          {/* 상단 그룹 정보 */}
          <View style={styles.header}>
            <View style={styles.headerIcon}><Text style={styles.headerIconText}>{groupName.charAt(0)}</Text></View>
            <View style={styles.headerTextBox}>
              <Text style={styles.headerTitle}>{groupName}</Text>
              {!!description && <Text style={styles.headerDesc} numberOfLines={2}>{description}</Text>}
              <Text style={styles.headerMeta}>멤버 {memberCount}명</Text>
            </View>
          </View>

          {/* 멤버가 아닐 때 가입 버튼 */}
          {!isMember && (
              <View style={styles.joinContainer}>
                <TouchableOpacity style={styles.joinButton} onPress={handleJoinGroup} disabled={isProcessingJoin}>
                  <Text style={styles.joinButtonText}>{isProcessingJoin ? '처리 중...' : '그룹 가입하기'}</Text>
                </TouchableOpacity>
              </View>
          )}

          {/* 멤버일 때의 UI */}
          {isMember && (
              <>
                <View style={styles.tabRow}>
                  <TouchableOpacity style={[styles.tabButton, tab === 'posts' && styles.tabButtonActive]} onPress={() => setTab('posts')}>
                    <Text style={[styles.tabText, tab === 'posts' && styles.tabTextActive]}>게시글</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tabButton, tab === 'schedules' && styles.tabButtonActive]} onPress={() => setTab('schedules')}>
                    <Text style={[styles.tabText, tab === 'schedules' && styles.tabTextActive]}>일정</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                  {tab === 'posts' ? (
                      <TouchableOpacity style={styles.primaryButton} onPress={() => setShowPostForm(p => !p)}>
                        <Text style={styles.primaryButtonText}>{showPostForm ? '작성 취소' : '새 게시글 작성'}</Text>
                      </TouchableOpacity>
                  ) : (
                      <TouchableOpacity style={styles.primaryButton} onPress={() => setScheduleDialogVisible(true)}>
                        <Text style={styles.primaryButtonText}>새 일정 추가</Text>
                      </TouchableOpacity>
                  )}
                </View>
              </>
          )}

          {/* 게시글 작성 폼 */}
          {isMember && tab === 'posts' && showPostForm && (
              <View style={styles.postForm}>
                <TextInput style={styles.postInput} placeholder="나누고 싶은 이야기를 공유해보세요." multiline value={newPostContent} onChangeText={setNewPostContent} />
                <View style={styles.attachmentButtonsContainer}>
                  <TouchableOpacity onPress={handleSelectImage} style={styles.imageSelectButton} disabled={!!attachedFile}>
                    <Icon name="add-photo-alternate" size={22} color={attachedFile ? '#9CA3AF' : '#374151'} />
                    <Text style={[styles.imageSelectButtonText, attachedFile && styles.disabledText]}>이미지</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSelectFile} style={styles.imageSelectButton} disabled={!!attachedImage}>
                    <Icon name="attach-file" size={22} color={attachedImage ? '#9CA3AF' : '#374151'} />
                    <Text style={[styles.imageSelectButtonText, attachedImage && styles.disabledText]}>파일</Text>
                  </TouchableOpacity>
                </View>
                {attachedImage?.uri && <Image source={{ uri: attachedImage.uri }} style={styles.thumbnail} />}
                {attachedFile?.uri && (
                    <View style={styles.filePreview}>
                      <Icon name="insert-drive-file" size={20} color="#6B7280" />
                      <Text style={styles.fileName} numberOfLines={1}>{attachedFile.name}</Text>
                    </View>
                )}
                <TouchableOpacity style={isUploading ? styles.submitButtonDisabled : styles.submitButton} onPress={handleCreatePost} disabled={isUploading}>
                  <Text style={styles.submitButtonText}>{isUploading ? '업로드 중...' : '게시하기'}</Text>
                </TouchableOpacity>
              </View>
          )}

          {/* 컨텐츠 목록 */}
          <View style={styles.contentArea}>
            {tab === 'posts' ? (
                <FlatList
                    data={posts}
                    renderItem={renderPost}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={postsLoading ? <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#FF8F00" /> : <View style={styles.emptyContainer}><Text style={styles.emptyText}>첫 게시글을 작성해보세요!</Text></View>}
                />
            ) : (
                <FlatList
                    data={schedules}
                    renderItem={renderSchedule}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>등록된 그룹 일정이 없습니다.</Text></View>}
                />
            )}
          </View>
        </KeyboardAvoidingView>

        <Dialog.Container visible={scheduleDialogVisible} onBackdropPress={() => setScheduleDialogVisible(false)}>
          <Dialog.Title>새 그룹 일정 추가</Dialog.Title>
          <Dialog.Description>그룹 전체에 공유될 일정을 등록합니다.</Dialog.Description>
          <Dialog.Input placeholder="일정 제목" value={newScheduleTitle} onChangeText={setNewScheduleTitle} wrapperStyle={styles.dialogInput} />
          <TouchableOpacity onPress={() => setIsCalendarVisible(true)}>
            <View style={styles.datePickerInput}>
              <Text style={newScheduleDate ? styles.datePickerText : styles.datePickerPlaceholder}>
                {newScheduleDate || '날짜 선택 (YYYY-MM-DD)'}
              </Text>
            </View>
          </TouchableOpacity>
          <Dialog.Button label="취소" onPress={() => setScheduleDialogVisible(false)} color="#888" />
          <Dialog.Button label="추가" onPress={handleCreateSchedule} bold />
        </Dialog.Container>
        <Modal
            transparent={true}
            visible={isCalendarVisible}
            onRequestClose={() => setIsCalendarVisible(false)}
            animationType="fade"
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsCalendarVisible(false)}>
            <View style={styles.calendarModalContent}>
              <Calendar
                  onDayPress={onDayPress}
                  markedDates={{
                    [newScheduleDate]: { selected: true, selectedColor: '#FF8F00' }
                  }}
                  // 현재 달을 기본으로 표시
                  current={new Date().toISOString().split('T')[0]}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
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
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  scheduleDateContainer: {
    marginRight: 16,
    padding: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
  },
  scheduleDateText: {
    color: '#FF8F00',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scheduleContentContainer: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scheduleAuthor: {
    fontSize: 12,
    color: '#666',
  },
  dialogInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginHorizontal: Platform.OS === 'ios' ? 0 : 15,
    marginTop: 10,
  },
  datePickerInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 10,
  },
  datePickerText: {
    fontSize: 16,
    color: '#000',
  },
  datePickerPlaceholder: {
    fontSize: 16,
    color: '#C7C7CD',
  },
  // [추가] 캘린더 모달 관련 스타일
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    width: '90%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
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
  joinContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  joinButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  contentArea: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
  },
  postForm: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
  },
  imageAttachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  imageSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  imageSelectButtonText: {
    fontWeight: '600',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginLeft: 15,
  },
  submitButton: {
    backgroundColor: '#FF8F00',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  attachmentButtonsContainer: {
    flexDirection: 'row',
    marginVertical: 12,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  fileName: {
    marginLeft: 8,
    color: '#374151',
    flexShrink: 1, // 텍스트가 너무 길면 줄어들도록 설정
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  disabledText: {
    color: '#9CA3AF',
  },
});
