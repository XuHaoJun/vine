import { valibotResolver } from '@hookform/resolvers/valibot'
import { memo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as v from 'valibot'
import { isWeb, ScrollView, SizableText, Spinner, Theme, XStack, YStack } from 'tamagui'

import { useTodos } from '~/features/todo/useTodos'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { PageContainer } from '~/interface/layout/PageContainer'
import { H1, H3 } from '~/interface/text/Headings'

const schema = v.object({
  text: v.pipe(v.string(), v.minLength(1, 'Todo text is required')),
})

type FormData = v.InferInput<typeof schema>

export const HomePage = memo(() => {
  const { todos, isLoading, addTodo, toggleTodo, deleteTodo } = useTodos()
  const insets = useSafeAreaInsets()

  const { control, handleSubmit, reset } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { text: '' },
  })

  const handleAddTodo = (data: FormData) => {
    addTodo(data.text.trim())
    reset()
  }

  const content = (
    <YStack
      position="relative"
      flexBasis="auto"
      bg="$background"
      flex={1}
      {...(isWeb && {
        width: '100vw' as any,
        ml: '50%' as any,
        transform: 'translateX(-50%)' as any,
        minHeight: '100vh' as any,
      })}
    >
      {/* notice banner */}
      <Theme name="yellow">
        <XStack bg="$color3" py="$3" width="100%">
          <PageContainer>
            <SizableText size="$4">
              This free stack was just extracted and needs syncing with the latest. We'll
              be back soon!
            </SizableText>
          </PageContainer>
        </XStack>
      </Theme>

      <YStack
        pb={isWeb ? '$10' : insets.bottom + 40}
        gap="$6"
        px="$4"
        width="100%"
        maxW={1200}
        mx="auto"
        flex={1}
      >
        {/* todo list */}
        <YStack flex={1} gap="$4" pt="$4">
          <H1 py="$2" size="$6">
            Todo Demo
          </H1>

          <XStack gap="$2" width="100%">
            <Controller
              control={control}
              name="text"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  flex={1}
                  placeholder="What needs to be done?"
                  value={value}
                  onChangeText={onChange}
                  error={error?.message}
                  onSubmitEditing={() => handleSubmit(handleAddTodo)()}
                  size="$6"
                  height={56}
                />
              )}
            />
            <Button onPress={handleSubmit(handleAddTodo)} theme="blue" px="$5">
              Add
            </Button>
          </XStack>

          {isLoading ? (
            <YStack p="$4" items="center" justify="center">
              <Spinner size="small" />
            </YStack>
          ) : todos.length === 0 ? (
            <YStack p="$4" items="center" justify="center" mt="$4">
              <H3>No todos yet - add one above!</H3>
            </YStack>
          ) : (
            <YStack gap="$2">
              {todos.map((todo) => (
                <XStack
                  key={todo.id}
                  p="$3"
                  bg="$color2"
                  rounded="$4"
                  items="center"
                  gap="$3"
                  pressStyle={{ opacity: 0.8 }}
                >
                  <XStack
                    width={20}
                    height={20}
                    rounded="$2"
                    borderWidth={2}
                    borderColor={todo.completed ? '$green9' : '$color8'}
                    bg={todo.completed ? '$green9' : 'transparent'}
                    items="center"
                    justify="center"
                    cursor="pointer"
                    onPress={() => toggleTodo(todo.id, !todo.completed)}
                  >
                    {todo.completed && (
                      <SizableText size="$1" color="white" fontWeight="bold">
                        ✓
                      </SizableText>
                    )}
                  </XStack>
                  <SizableText
                    flex={1}
                    textDecorationLine={todo.completed ? 'line-through' : 'none'}
                    opacity={todo.completed ? 0.6 : 1}
                  >
                    {todo.text}
                  </SizableText>
                  <Button theme="red" px="$3" onPress={() => deleteTodo(todo.id)}>
                    ✕
                  </Button>
                </XStack>
              ))}
            </YStack>
          )}
        </YStack>

        {/* about section */}
        <YStack
          display="none"
          pt="$4"
          gap="$4"
          $lg={{ display: 'flex', width: 340, pt: '$12' }}
        >
          <Theme name="blue">
            <YStack
              p="$4"
              bg="$color3"
              rounded="$4"
              borderColor="$color6"
              borderWidth={1}
            >
              <H3 mb="$2" color="$color11">
                Takeout Free
              </H3>
              <YStack gap="$2" opacity={0.8}>
                <SizableText size="$6">
                  A minimal but complete stack for native and web apps.
                </SizableText>
                <YStack gap="$1" mt="$1">
                  <SizableText size="$4" color="$color11">
                    One • Tamagui • Zero • Better Auth
                  </SizableText>
                  <SizableText size="$4" color="$color11">
                    Bun • TypeScript
                  </SizableText>
                </YStack>
                <SizableText size="$4" mt="$2" opacity={0.7}>
                  Includes scripts for dev, build, deploy, and a clean package structure
                  ready for production.
                </SizableText>
              </YStack>
            </YStack>
          </Theme>
        </YStack>
      </YStack>
    </YStack>
  )

  if (isWeb) {
    return content
  }

  return (
    <ScrollView flex={1} pt={insets.top + 16}>
      {content}
    </ScrollView>
  )
})
