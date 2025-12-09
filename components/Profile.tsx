import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const Profile: React.FC = () => {
  const currentUser = auth().currentUser;

  const handleLogout = () => {
    Alert.alert(
      "로그아웃",
      "정말 로그아웃 하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        { text: "확인", onPress: () => auth().signOut() }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileBox}>
        <MaterialIcons name="person" size={80} color="#FF8F00" />
        <Text style={styles.emailText}>
          {currentUser ? currentUser.email : '로그인 정보 없음'}
        </Text>
        <Text style={styles.uidText}>
          User ID: {currentUser ? currentUser.uid : 'N/A'}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <MaterialIcons name="logout" size={24} color="#fff" />
        <Text style={styles.buttonText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    padding: 20,
    justifyContent: 'space-between',
  },
  profileBox: {
    marginTop: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  emailText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#333',
  },
  uidText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#FF8F00',
    padding: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default Profile;