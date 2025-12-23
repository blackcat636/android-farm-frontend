'use client';

import { useEffect, useState } from 'react';
import { Table, Tag, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createBackendClient, tokenStorage, type Post, type PostLike } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

interface PostWithLikes extends Post {
  likes?: PostLike[];
}

export default function PostsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithLikes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingLikesFor, setLoadingLikesFor] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);
        const response = await backendClient.getPosts({
          platform: 'instagram',
          page: 1,
          limit: 100,
        });
        setPosts(response.data);
      } catch (err: any) {
        setError(err.message || 'Error loading posts');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user]);

  const loadLikesForPost = async (postId: string) => {
    // Якщо лайки вже завантажені — не перезавантажуємо
    const existing = posts.find((p) => p.id === postId);
    if (!existing || existing.likes) return;

    try {
      setLoadingLikesFor(postId);
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Необхідна авторизація');
      }

      const backendClient = createBackendClient(token);
      const likes = await backendClient.getPostLikes(postId);

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes } : p)),
      );
    } catch (err: any) {
        setError(err.message || 'Error loading likes');
    } finally {
      setLoadingLikesFor(null);
    }
  };

  const columns: ColumnsType<PostWithLikes> = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Caption',
      dataIndex: 'caption',
      key: 'caption',
      render: (text) => text || '-',
    },
    {
      title: 'Post URL',
      dataIndex: 'post_url',
      key: 'post_url',
      render: (url) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: 'Likes',
      dataIndex: 'likes',
      key: 'likes',
      render: (_, record) =>
        record.likes ? record.likes.length : loadingLikesFor === record.id ? '...' : 'click row',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString('en-US'),
    },
  ];

  if (loading && !posts.length) {
    return <Loading />;
  }

  if (error && !posts.length) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <h1>Posts</h1>
      <Card>
        <Table<PostWithLikes>
          columns={columns}
          dataSource={posts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          expandable={{
            expandedRowRender: (record) => (
              <div>
                <h4>Likes</h4>
                {record.likes && record.likes.length > 0 ? (
                  <Table<PostLike>
                    size="small"
                    pagination={false}
                    rowKey="id"
                    dataSource={record.likes}
                    columns={[
                      {
                        title: 'Account ID',
                        dataIndex: 'account_id',
                        key: 'account_id',
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        render: (status) => {
                          const colors: Record<string, string> = {
                            success: 'green',
                            failed: 'red',
                            pending: 'orange',
                          };
                          return <Tag color={colors[status] || 'default'}>{status}</Tag>;
                        },
                      },
                      {
                        title: 'Liked At',
                        dataIndex: 'liked_at',
                        key: 'liked_at',
                        render: (text) =>
                          text ? new Date(text).toLocaleString('en-US') : '-',
                      },
                    ]}
                  />
                ) : (
                  <div>No likes yet</div>
                )}
              </div>
            ),
            onExpand: (expanded, record) => {
              if (expanded) {
                void loadLikesForPost(record.id);
              }
            },
          }}
        />
      </Card>
    </div>
  );
}


