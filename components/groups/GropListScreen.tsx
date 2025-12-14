// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

const dummyGroups = [
    {
        id: '1',
        name: '2025 ������ �غ��',
        description: '�Բ� ������ ���� �غ��ؿ�!',
        memberCount: 24,
        postCount: 156,
        scheduleCount: 3,
    },
    {
        id: '2',
        name: '��� �ڼҼ� ���͵�',
        description: '���� �ǵ�� �ְ�޴� ���͵��Դϴ�.',
        memberCount: 8,
        postCount: 42,
        scheduleCount: 5,
    },
    {
        id: '3',
        name: '���� 900 ��ǥ��',
        description: '���� �ܾ� + LC/RC Ǯ��',
        memberCount: 15,
        postCount: 73,
        scheduleCount: 2,
    },
];

export default function GroupListScreen({ navigation }) {
    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() =>
                navigation.navigate('GroupDetail', {
                    groupId: item.id,
                    groupName: item.name,
                })
            }
        >
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.description}>{item.description}</Text>
            <View style={styles.metaRow}>
                <Text style={styles.metaText}>��� {item.memberCount}��</Text>
                <Text style={styles.metaText}>�Խñ� {item.postCount}��</Text>
                <Text style={styles.metaText}>���� {item.scheduleCount}��</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>�׷� ���</Text>
            <FlatList
                data={dummyGroups}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 24,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    groupName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: '#555555',
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metaText: {
        fontSize: 12,
        color: '#888888',
    },
});
