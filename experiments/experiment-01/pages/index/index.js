// index.js
const app =getApp()
Page({
    data:{
        wording:'girl'
    },
    onClick:function(){
        this.setData({
            wording:this.data.wording=='girl'?'boy':'girl'
        })
    }
})
