import React, {useEffect, useMemo, useState} from 'react'
import {Header} from '../component/Header'
import {Button} from '../component/Button'
import {message} from '../component/Message'
import {Crumbs} from '../component/Crumbs'
import {Table, Tr} from '../component/Table'
import {Icon} from '../component/Icon'
import {isFile, sizeToByte} from '../../common/util'
import {rmFile, rmFolder} from '../../common/core/rm'
import {ls} from '../../common/core/ls'
import {Bar} from '../component/Bar'
import {useRequest} from '../hook/useRequest'
import requireModule from '../../common/requireModule'
import {ScrollView} from '../component/ScrollView'
import {Input, Textarea} from '../component/Input'
import {Modal} from '../component/Modal'
import {mkdir} from '../../common/core/mkdir'
import download from '../store/Download'
import upload from '../store/Upload'
import {fileDetail, folderDetail} from '../../common/core/detail'
const electron = requireModule('electron')

interface FolderForm {
  name: string
  folderDesc: string
}

export default function Files() {
  const [visible, setVisible] = useState(false)
  const {loading, request} = useRequest()
  const [form, setForm] = useState({} as FolderForm)

  const [list, setList] = useState({} as AsyncReturnType<typeof ls>)
  const currentFolder = useMemo(() => list.info?.find(item => item.now === 1)?.folderid || -1, [list])

  function listFile(folder_id) {
    request(ls(folder_id), 'ls').then(value => setList(value))
  }

  useEffect(() => listFile(-1), [])

  useEffect(() => {
    const refresh = () => listFile(currentFolder)
    upload.on('finish', refresh)
    return () => upload.removeListener('finish', refresh)
  }, [currentFolder])

  function cancel() {
    setVisible(false)
    setForm({} as FolderForm)
  }

  async function makeDir() {
    await request(mkdir(currentFolder, form.name, form.folderDesc), 'mkdir')
    message.success('创建成功')
    cancel()
    listFile(currentFolder)
  }

  return (
    <ScrollView
      onDragEnter={() => {
        message.destroy()
        message.info('放开上传')
      }}
      onDragOver={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onDrop={event => {
        message.destroy()
        message.success('上传中...')
        Array.prototype.map.call(event.dataTransfer.files, (file: File) => {
          upload.addTask({
            folderId: currentFolder,
            size: file.size,
            name: file.name,
            type: file.type,
            path: file.path,
            lastModifiedDate: file.lastModified,
          })
        })
      }}
      HeaderComponent={
        <>
          <Header>
            <Button
              icon={'upload'}
              file
              onChange={files => {
                Array.prototype.map.call(files, (file: File) => {
                  upload.addTask({
                    folderId: currentFolder,
                    size: file.size,
                    name: file.name,
                    type: file.type,
                    path: file.path,
                    lastModifiedDate: file.lastModified,
                  })
                })
              }}
            >
              上传
            </Button>
            <Button
              type={'primary'}
              onClick={() => {
                setVisible(true)
              }}
            >
              新建文件夹
            </Button>
          </Header>
          <Bar>
            <Crumbs
              crumbs={[{name: '全部文件', folderid: -1}, ...(list.info || [])]}
              onClick={folderid => listFile(folderid)}
            />
            {(loading['ls'] || loading['download']) && <Icon iconName={'loading'} />}
          </Bar>
        </>
      }
    >
      <Table header={['文件名', '大小', '时间', '下载']}>
        {list.text?.map(item => {
          const size = 'id' in item ? item.size : '-'
          const time = 'id' in item ? item.time : ''
          const downs = 'id' in item ? item.downs : ''
          const id = 'id' in item ? item.id : item.fol_id

          return (
            <Tr key={id}>
              <td className='table-file'>
                {'id' in item ? (
                  <>
                    <Icon iconName={'file'} />
                    <span>{item.name_all}</span>
                    <div className='handle'>
                      <Icon
                        iconName={'share'}
                        onClick={async () => {
                          const info = await fileDetail(item.id)
                          const shareUrl = `${info.is_newd}/${info.f_id}${
                            info.onof === '1' ? `\n密码: ${info.pwd}` : ''
                          }`
                          electron.clipboard.writeText(shareUrl)
                          message.success(`分享链接已复制：\n${shareUrl}`)
                        }}
                      />
                      <Icon
                        iconName={'download'}
                        onClick={() => {
                          request(
                            download.addFileTask({
                              name: item.name,
                              size: sizeToByte(item.size),
                              file_id: `${item.id}`,
                            }),
                            'download'
                          )
                        }}
                      />
                      <Icon
                        iconName={'delete'}
                        onClick={async () => {
                          const {zt, info} = await rmFile(id)
                          if (zt !== 1) return message.error(info)
                          message.success('已删除')
                          listFile(currentFolder)
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Icon iconName='folder' />
                    <span onClick={() => listFile(item.fol_id)}>{item.name}</span>
                    <div className='handle'>
                      <Icon
                        iconName={'share'}
                        onClick={async () => {
                          const info = await folderDetail(item.fol_id)
                          const shareUrl = `${info.new_url}${info.onof === '1' ? `\n密码: ${info.pwd}` : ''}`
                          electron.clipboard.writeText(shareUrl)
                          message.success(`分享链接已复制：\n${shareUrl}`)
                        }}
                      />
                      <Icon
                        iconName={'download'}
                        onClick={() => {
                          request(
                            download.addFolderTask({
                              folder_id: item.fol_id,
                              merge: isFile(item.name),
                              name: item.name,
                            }),
                            'download'
                          )
                        }}
                      />
                      <Icon
                        iconName={'delete'}
                        onClick={async () => {
                          const {zt, info} = await rmFolder(item.fol_id)
                          if (zt !== 1) return message.error(info)
                          message.success('已删除')
                          listFile(currentFolder)
                        }}
                      />
                    </div>
                  </>
                )}
              </td>
              <td>{size}</td>
              <td>{time}</td>
              <td>{downs}</td>
              <td />
            </Tr>
            /*<Tr key={id}>
              <td>
                {'id' in item ? (
                  <>
                    <Icon iconName={'file'} />
                    <span>{item.name_all}</span>
                  </>
                ) : (
                  <>
                    <Icon iconName='folder' />
                    <span onClick={() => listFile(item.fol_id)}>{item.name}</span>
                  </>
                )}
                <div className='handle'>
                  {'id' in item && (
                    <Icon
                      iconName={'share'}
                      onClick={async () => {
                        const info = await fileDetail(item.id)
                        const shareUrl = `${info.is_newd}/${info.f_id}`
                        // todo: 分享文件夹
                        electron.clipboard.writeText(shareUrl)
                        message.success(`分享链接已复制：\n${shareUrl}`)
                      }}
                    />
                  )}
                  {isFile(item.name) && (
                    <Icon
                      iconName={'download'}
                      onClick={() => {
                        if ('id' in item) {
                          request(
                            download.addFileTask({
                              name: item.name,
                              size: sizeToByte(item.size),
                              file_id: `${item.id}`,
                            }),
                            'download'
                          )
                        } else {
                          request(
                            download.addFolderTask({
                              folder_id: item.fol_id,
                              merge: isFile(item.name),
                              name: item.name,
                            }),
                            'download'
                          )
                        }
                      }}
                    />
                  )}
                  <Icon
                    iconName={'delete'}
                    onClick={async () => {
                      const {zt, info} = await rm(id, 'id' in item)
                      if (zt === 1) {
                        message.success('已删除')
                        listFile(currentFolder)
                      } else {
                        message.info(info)
                      }
                    }}
                  />
                </div>
              </td>
              <td>{size}</td>
              <td>{time}</td>
              <td>{downs}</td>
              <td />
            </Tr>*/
          )
        })}
      </Table>

      <Modal visible={visible}>
        <div className='dialog'>
          <div style={{width: 400}}>
            <h3>文件名</h3>
            <Input
              value={form.name}
              placeholder={'不能包含特殊字符，如：空格，括号'}
              onChange={event => setForm(prevState => ({...prevState, name: event.target.value}))}
            />
            <h3>文件描述</h3>
            <Textarea
              value={form.folderDesc}
              placeholder={'可选项，建议160字数以内。'}
              maxLength={160}
              onChange={event => setForm(prevState => ({...prevState, folderDesc: event.target.value}))}
            />
            <div style={{textAlign: 'right', marginTop: 10}}>
              <Button onClick={cancel}>取消</Button>
              <Button loading={loading['mkdir']} type={'primary'} onClick={makeDir}>
                保存
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </ScrollView>
  )
}
