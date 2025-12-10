import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'react-native-image-picker';

const Profile: React.FC = () => {
  const currentUser = auth().currentUser;

  const [displayName, setDisplayName] = useState('');
  const [major, setMajor] = useState('');
  const [goal, setGoal] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const userDocRef = firestore().collection('users').doc(currentUser.uid);
    userDocRef.get().then(doc => {
      if (doc.exists) {
        const data = doc.data();
        setDisplayName(data?.displayName || '');
        setMajor(data?.major || '');
        setGoal(data?.goal || '');
        setIntroduction(data?.introduction || '');
        setAdditionalInfo(data?.additionalInfo || '');
        setProfileImage(data?.profileImage || null);
      }
    });
  }, []);

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    try {
      await firestore().collection('users').doc(currentUser.uid).set(
        {
          displayName,
          major,
          goal,
          introduction,
          additionalInfo,
          profileImage,
        },
        { merge: true },
      );
      Alert.alert('성공', '프로필이 저장되었습니다.');
    } catch (error) {
      console.error('프로필 저장 오류:', error);
      Alert.alert('오류', '프로필 저장에 실패했습니다.');
    }
  };

  const handlePickImage = () => {
    ImagePicker.launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1 },
      response => {
        if (response.assets && response.assets.length > 0) {
          setProfileImage(response.assets[0].uri || null);
        }
      },
    );
  };

  const handleLogout = () => {
    auth()
      .signOut()
      .then(() => {
        Alert.alert('로그아웃', '성공적으로 로그아웃되었습니다.');
      })
      .catch(err => {
        console.error('로그아웃 오류:', err);
        Alert.alert('오류', '로그아웃에 실패했습니다.');
      });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* 저장 버튼 상단 우측 */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
        <Text style={styles.saveButtonText}>저장</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* 프로필 사진 */}
        <TouchableOpacity style={styles.imageContainer} onPress={handlePickImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholder}>
              <MaterialIcons name="person" size={60} color="#888" />
            </View>
          )}
          <Text style={styles.changePhotoText}>프로필 사진 변경</Text>
        </TouchableOpacity>

        {/* 닉네임 */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>닉네임</Text>
          <TextInput
            style={styles.input}
            placeholder="닉네임 입력"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        {/* 전공 */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>전공</Text>
          <TextInput
            style={styles.input}
            placeholder="전공 입력"
            value={major}
            onChangeText={setMajor}
          />
        </View>

        {/* 목표 */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>목표</Text>
          <TextInput
            style={styles.input}
            placeholder="목표 입력"
            value={goal}
            onChangeText={setGoal}
          />
        </View>

        {/* 소개 */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>소개</Text>
          <TextInput
            style={[styles.input, { height: 100 }]}
            placeholder="소개 입력"
            multiline
            value={introduction}
            onChangeText={setIntroduction}
          />
        </View>

        {/* 추가 정보 카드 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>추가 정보</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="추가 정보 입력"
            multiline
            value={additionalInfo}
            onChangeText={setAdditionalInfo}
          />
        </View>

        {/* 로그아웃 버튼 */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 40 },
  saveButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: '#FF8F00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  imageContainer: { alignItems: 'center', marginBottom: 30 },
  profileImage: { width: 120, height: 120, borderRadius: 60 },
  placeholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: { marginTop: 10, color: '#555' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 44,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  card: {
    borderWidth: 1,
    borderColor: '#FF8F00',
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    backgroundColor: '#FFF8E1',
  },
  cardLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  logoutButton: {
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default Profile;
