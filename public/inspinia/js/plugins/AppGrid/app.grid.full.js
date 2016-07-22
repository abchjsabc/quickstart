
var AppGrid = function(settings){
    this.def = $.extend(true, {}, APP_GRID_GLOBAL_OBJECT.default_config, settings);
    if(this.def.serverSide.enable){
        this.rebuildDef();
    }
    this.height = {
        tr: {outerHeight: 0},
        th: {outerHeight: 0},
        toolbar: {outerHeight: 0},
        paginator: {outerHeight: 0}
    };
    this.width = {};
    this.position = {};
    this.get = new AppGridGet(this);
    this.set = new AppGridSet(this);
    this.grid = $('#'+this.def.id);
    this.def.contextmenu !== true && this.grid.contextmenu(function(){return false;});//整个表格内禁用右键菜单
    this.width['grid'] = this.grid.width();
    this.hover();
    this.init();

    this.grid.data('appgrid',this);
    this.grid.addClass('appgrid-resize');

    if(this.def.serverSide.enable){
        this.loadData(this.def.serverSide.url,null);
    }
};


AppGrid.prototype.init = function(){
    this.init_items = null;
    this.init_records = [];
    this.storageResize();
    this.repair();
    this.scroll_update_status = false;
    this.storageDisplay();
    this.init_columns = $.extend(true, [], this.def.columns);
    this.empty_output_status = false;
    this.columns = [];
    this.config();
    this.begin();
    this.output();
    this.listenEvent();
};


/**
 * 根据已有的def，去构造新的def，封装分页和服务器端加载，使得使用起来更方便
 * add by skywodpeng
 */
AppGrid.prototype.rebuildDef = function(){
    var _this = this;
    if(this.def.serverSide.enable){
        // 初始化分页条相关的参数
        if(this.def.serverSide.paginator.enable){
            this.def.paginator.enable = true;
            if(this.def.serverSide.paginator.page_index){
                this.def.paginator.page_index = this.def.serverSide.paginator.page_index;
            }

            if(this.def.serverSide.paginator.page_size){
                this.def.paginator.page_size = this.def.serverSide.paginator.page_size;
            }
            if(this.def.serverSide.paginator.page_items){
                this.def.paginator.page_items = this.def.serverSide.paginator.page_items;
            }

            this.def.paginator.proxy = function(params){
                _this.loadData(this.def.serverSide.url, params)
            }
        }

        // 初始化sort相关的参数
        if(this.def.serverSide.sortable.enable){
            this.def.sortable.enable = true;
            if(this.def.serverSide.sortable.sort_field){
                this.def.sortable.sort_field = this.def.serverSide.sortable.sort_field
            }
            if(this.def.serverSide.sortable.sort_asc){
                this.def.sortable.sort_asc = this.def.serverSide.sortable.sort_asc
            }

            this.def.sortable.proxy = function(params){
                _this.loadData(this.def.serverSide.url, params)
            }
        }
    }
}

AppGrid.prototype.getRenderColumns = function(){
    var columns = [];
    $.each(this.render,function(key1,render){
        $.each(render.column.dimension_items,function(key2,item){
            columns.push(item.mapping[0]);
        });
    });
    return columns;
}

/**
 * 使用新的加载数据的接口
 * add by skywodpeng
 */
AppGrid.prototype.loadData = function(url,params){
    var _this = this;
    if(!params){
        params = {
            'page_index':this.def.paginator.page_index,
            'page_size':this.def.paginator.page_size,
            'sort_field':this.def.sortable.sort_field,
            'sort_asc':this.def.sortable.sort_asc
        }
    };

    params.show_columns = _this.getRenderColumns().join(',');
    params.page = params.page_index;
    params.perpage = params.page_size;
    params.sorton = params.sort_field;
    params.sortby = params.sort_asc;

    if(typeof this.def.serverSide.condition == 'function'){
        params = $.extend(true,params, this.def.serverSide.condition());
    }

    var beforeSend = function(){
        if(_this.def.paginator.enable){
            _this.paginator.set('loading', true);
        }
        if(_this.def.loadMask&&_this.def.loadMask.enable){
            var maskId = _this.def.id+'loadMask';
            var maskWidth = $('#body-'+_this.def.id).width();
            var maskHeight = $('#body-'+_this.def.id).height();
            var maskTop = $('#body-'+_this.def.id).offset().top;
            var maskLeft = $('#body-'+_this.def.id).offset().left;
            if(maskHeight>20){
                var loadMask = '<div id="'+maskId+'" class="apt-grid-load-mark"><div class="sk-spinner sk-spinner-three-bounce"><div class="sk-bounce1"></div><div class="sk-bounce2"></div><div class="sk-bounce3"></div></div></div>';
                $(loadMask).css({'width':maskWidth,'height':maskHeight,'top':maskTop,'left':maskLeft,'line-height':maskHeight+'px'}).appendTo('body');
            }
        }
    }
    beforeSend();

    var success = function(response){
        if(_this.def.paginator.enable){
            _this.paginator.set('loading', false)
            _this.def.paginator.page_index = params.page_index;
            _this.def.paginator.page_size = params.page_size;
        }
        if(_this.def.loadMask&&_this.def.loadMask.enable){
            var maskId = _this.def.id+'loadMask';
            $('#'+maskId).remove();
        }

        if(_this.def.serverSide.afterRequest)
        {
            _this.def.serverSide.afterRequest.apply(_this,[response]);
        }

        if(response.ret_code == 0){                
            _this.set.records(response.ret_msg.records);
            _this.set.total(response.ret_msg.total);                

            if(response.ret_msg.summary){
                _this.set.summary(response.ret_msg.summary);
            }

            if(response.ret_msg.display){
                _this.set.display(response.ret_msg.display);
            }
            else if(response.ret_msg.hide){
                _this.set.hide(response.ret_msg.hide);
            }
            else
            {
                _this.renderBody();
                _this.renderFoot();
            }
        }
        else
        {
            _this.set.records([]);
            _this.set.total(0);
            _this.renderBody();

            if(!_this.def.serverSide.afterRequest)
            {
                alert(response.ret_msg);
            }
        }
    }

    var error = function(ret){
        if(_this.def.serverSide.afterError)
        {
            _this.def.serverSide.afterError.apply(_this,[ret]);
        }
        else
        {
            _this.def.empty.text = (ret.error)?ret.error:'数据加载失败';
            _this.renderBody();            
        }
    }

    if(this.def.serverSide.nghttp)
    {
        this.def.serverSide.nghttp($.extend({
            'url':url,
            'method':this.def.serverSide.method.toUpperCase(),
            'responseType':'json',
            'headers': {
                'X-CSRF-Token':typeof(get_csrf_token)!='undefined'?get_csrf_token():'',
                'from-app-grid':1
            }
        },_this.def.serverSide.nghttpConfig,this.def.serverSide.method.toUpperCase()=='POST'?{data:params}:{params:params})).success(success).error(error);
    }
    else
    {
        $.ajax({
            'url':url,
            'type':this.def.serverSide.method,
            'dataType':'json',
            'data': params,
            'headers': {
                'X-CSRF-Token':typeof(get_csrf_token)!='undefined'?get_csrf_token():'',
                'from-app-grid':1
            },
            'success':success,
            'error':function(ret){
				error(ret.responseJSON);
			}
        });
    }    
}

/**
 * Grid重新加载，在服务器端加载的时候，该方法从后台重新加载数据
 * add by skywodpeng
 */
AppGrid.prototype.reload = function(params){

    if(params && params.page_index>0)
    {
        this.def.paginator.page_index = params.page_index;
        this.paginator.set('page_index',params.page_index);
    }   

    this.loadData(this.def.serverSide.url);
}

/**
 * 监听事件，目前需要的是windows resize的时候重新绘制表格，以达到适合自适应的效果
 * add by skywodpeng
 */
AppGrid.prototype.listenEvent = function(){
    var timeout;
    $(window).off('resize.appgrid');
    $(window).on('resize.appgrid',function() {
        if(timeout) clearTimeout(timeout);
        timeout = setTimeout(
            function () {
                $('.appgrid-resize').each(function(){
                    var self = $(this).data('appgrid');
                    if(!self)return;

                    self.grid.empty();
                    self.width = {};
                    self.position = {};
                    self.width['grid'] = self.grid.width();
                    self.head_render = undefined;
                    self.toolbar = undefined;
					self.body_render = undefined;
					self.foot_render = undefined;
                    self.paginator = undefined;
                    self.begin();
                    self.output();
                    self.renderBody();
                    self.renderFoot();
                });
            }, 200);
        // 延时200ms执行
    });
}

/**
 * 获取localStorage对应的key
 * @param type
 */
AppGrid.prototype.getStorageKey = function(type){
    switch(type){
        case 'item-setting':
            return typeof this.def.toolbar.setting.storage == 'function' ? this.def.toolbar.setting.storage.call(this) : window.location.host + window.location.pathname + this.def.id + type;
        case 'item-resize':
            return typeof this.def.resize.storage == 'function' ? this.def.resize.storage.call(this) : window.location.host + window.location.pathname + this.def.id + type;
    }
};
/**
 * 提取存储的列显示设置数据
 */
AppGrid.prototype.storageDisplay = function(){
    var _this = this;
    _this.storage_display = null;
    if(_this.def.toolbar.setting.storage !== false && window.localStorage){
        var storage_display = localStorage.getItem(_this.getStorageKey('item-setting'));
        if(storage_display){
            _this.storage_display = {};
            $.each(storage_display.split(';'), function(index, field){
                _this.storage_display[field] = true;
            });
        }
    }
};
/**
 * 提取存储的列缩放（即宽度）设置
 */
AppGrid.prototype.storageResize = function(){
    var _this = this;
    _this.storage_item_resize = {};
    if(_this.def.resize.storage !== false && window.localStorage){
        var key = _this.getStorageKey('item-resize');
        var items = localStorage.getItem(key);
        if(items){
            $.each(items.split(';'), function(index, item){
                var resize = item.split(':');
                _this.storage_item_resize[resize['0']] = resize['1'];
            });
        }
    }
};
/**
 * 修复配置columns缺少的属性，替换存储的列宽度
 */
AppGrid.prototype.repair = function(){
    var _this = this;
    var loop = function(items){
        $.each(items, function(index, item){
            if(item.items){
                item.id = APP_GRID_GLOBAL_OBJECT.generate(_this.def.id);
                loop(item.items);
            }else{
                if(_this.storage_item_resize[item.mapping['0']]){
                    item.width = parseInt(_this.storage_item_resize[item.mapping['0']]);
                }
            }
        });
    };
    $.each(this.def.columns, function(index, column){
        loop(column.items);
    });
};
/**
 * 处理相冲突的配置信息
 */
AppGrid.prototype.config = function(){
    if(this.def.rowspan.enable){
        this.def.drag.enable = false;
    }
    if(this.def.paginator.enable){
        this.def.section.enable = false;
    }
    if(this.def.section.enable){
        this.def.fixed.height = this.def.section.height;
    }
    if(this.def.fixed.height){
        this.init_fixed_height = this.def.fixed.height;
    }
};
AppGrid.prototype.begin = function(){
    var _this = this, last_frozen = null, un_frozen_length = 0, total_width = 0, remain_width = 0, current_columns = $.extend(true, [], _this.def.columns), init_items = false;
    _this.max_column_level = {field: '', value: 1};
    _this.field_to_items = {};
    _this.index_to_field = [];
    _this.items_length = 0;
    _this.items_id_holder = {};
    /**记录初始显示列，以data.display为准，不会被存储的自定义列设置影响**/
    if(_this.init_items === null){
        init_items = true;
        _this.init_items = {};
    }
    $.each(current_columns, function(key, column){
        column.table_id = _this.def.id + '-' + column.name;
        if(_this.columns[key] === undefined){
            _this.columns[key] = column;
        }
        _this.two_dimension_items = [];
        var enable_column = _this.transItems(column, key, init_items);
        if(_this.def.checkbox.enable && key == 0){
            _this.def.checkbox.item.name = column.name;
            _this.items_length++;
            enable_column['1'].splice(_this.def.checkbox.position, 0, _this.def.checkbox.item);
            _this.two_dimension_items.splice(_this.def.checkbox.position, 0, _this.def.checkbox.item);
        }
        _this.columns[key].items = enable_column;
        _this.columns[key].dimension_items = _this.two_dimension_items;
        _this.columns[key].width = 0;
        if(_this.columns[key].frozen){
            $.each(_this.columns[key].items, function(index, level){
                $.each(level, function(num, item){
                    !item.width && (item.width = _this.def.itemwidth);
                    _this.columns[key].width += item.width;
                });
            });
            //如果固定宽度的表格宽度之和已经超过grid总宽度减一个默认单元格宽度，则设置当前表格为非固定
            if(_this.columns[key].width + total_width + _this.def.itemwidth >= _this.width['grid']){
                _this.columns[key].width = 0;
                _this.columns[key].frozen = false;
                un_frozen_length++;
            }else{
                total_width += _this.columns[key].width;
            }
        }else{
            !_this.columns[key].width && un_frozen_length++;
        }
        last_frozen = !!_this.columns[key].frozen;
        _this.two_dimension_items = null;
    });
    if(init_items){
        _this.def.data.display = {};
        $.each(_this.field_to_items, function(field, item){
            _this.def.data.display[field] = true;
        });
    }
    remain_width = _this.width['grid'] - total_width;
    if(un_frozen_length == 1 && last_frozen === true){
        $.each(_this.columns, function(index, column){
           !column.frozen && (column.width = remain_width);
            column.max_column_level = _this.max_column_level.value;
        });
    }else{
        if(un_frozen_length > 1){
            var avg_remain_width = Math.ceil(remain_width / un_frozen_length), remain = remain_width - avg_remain_width * un_frozen_length;
            $.each(_this.columns, function(index, column){
                if(!column.frozen && !column.width){
                    column.width = avg_remain_width + remain;
                    remain = 0;
                }
                column.max_column_level = _this.max_column_level.value;
            });
        }else{
            $.each(_this.columns, function(index, column){
                column.max_column_level = _this.max_column_level.value;
            });
        }
    }
};
AppGrid.prototype.output = function(){
	this.scroll_obj = {};
	this.outHtml();
	this.renderHead();
	this.def.itemsoperate.enable && this.item_operate === undefined && (this.item_operate = new AppGridItemOperate(this));
	this.def.checkbox.enable && this.empty_output_status === false && (this.checkbox = new AppGridCheckbox(this));
	this.def.selection.enable && this.selection === undefined && (this.selection = new AppGridSelection(this));	
	this.def.drag.enable && this.draggable === undefined && (this.draggable = new AppGridDraggable(this));
	this.def.toolbar.enable && this.toolbar === undefined && (this.toolbar = new AppGridToolbar(this)) && (this.height.toolbar = {outerHeight: this.tool_holder.outerHeight()});
	if(this.def.paginator.enable && this.paginator === undefined){
		this.paginator = new AppGridPaginator(this);
		this.height.paginator.outerHeight = this.page_holder.outerHeight();
	}
};
AppGrid.prototype.refreshOutPut = function(){
	var _this = this;
	$.each(_this.columns, function(index, column){
		_this.render[column.table_id]['column'] = column;
		_this.render[column.table_id].head_place.css({'width': column.width > 0 ? column.width : 'auto'});
		_this.render[column.table_id].body_place.css({'width': column.width > 0 ? column.width : 'auto'});
		_this.render[column.table_id].foot_place.css({'width': column.width > 0 ? column.width : 'auto'});
		_this.render[column.table_id].bars_place.css({'width': column.width > 0 ? column.width : 'auto'});
	});
};
/**
 * 处理表格配置数据，控制可见与不可见
 */
AppGrid.prototype.transItems = function(column, path, init_items){
    var _this = this, storage = {};
    _this.loopItems({
        name: column.name,
        path: path,
        level: 1,
        items: column.items,
        frozen: column.frozen,
        storage: storage,
        init_items: init_items,
        table_id: column.table_id
    });
    return storage;
};
AppGrid.prototype.loopItems = function(params){
    var _this = this, result = {items: [], length: 0};
    $.each(params.items, function(index, item){
        var path = params.path + '-' + index;
        var level = params.level + 1;
        if(item.items && item.items.length){
            _this.items_id_holder[item.id] =  true;
            var loop_params = {
                name: params.name,
                path: path,
                level: level,
                items: item.items,
                frozen: params.frozen,
                storage: params.storage,
                init_items: params.init_items,
                table_id: params.table_id
            };
            var temp = _this.loopItems(loop_params);
            if(temp.length){
                if(temp.length > 1){
                    delete item.items;
                    delete item.mapping;
                    item.length = temp.length;
                    result.length += temp.length;
                    result.items.push(item);
                }else{
                    var temp_item = temp['items']['0'], mapping = temp_item.mapping[0], temp_storage = params.storage[params.level + 1];
                    if(_this.max_column_level.field == mapping){
                        _this.max_column_level.value = params.level;
                    }
                    if(item.cover === true){
                        temp_item['title'] = item['title'];
                    }
                    result.length++;
                    result.items.push(temp_item);
                    if(temp_storage.length == 1){
                        delete params.storage[params.level + 1];
                    }else{
                        for(var i = 0, len = temp_storage.length; i < len; i++){
                            if(temp_storage[i]['mapping']['0'] == mapping){
                                params.storage[params.level + 1].splice(i, 1);
                                break;
                            }
                        }
                    }
                }
            }
        }else{
            if(item.mapping){
                var mapping = item.mapping[0];
                if(mapping && (_this.def.data.display === null || _this.def.data.display[mapping] === true)){
                    if(params.init_items){
                        _this.init_items[mapping] = item;
                        _this.init_items[mapping]['path'] = path;
                        _this.init_items[mapping]['name'] = params.name;
                        _this.init_items[mapping]['frozen'] = params.frozen;
                        _this.init_items[mapping]['table_id'] = params.table_id;
                    }
                    if(_this.storage_display === null || _this.storage_display[mapping] === true){
                        _this.field_to_items[mapping] = item;
                        _this.field_to_items[mapping]['path'] = path;
                        _this.field_to_items[mapping]['name'] = params.name;
                        _this.field_to_items[mapping]['frozen'] = params.frozen;
                        _this.field_to_items[mapping]['table_id'] = params.table_id;
                        delete item.length;
                        _this.items_length++;
                        _this.index_to_field.push(mapping);
                        _this.two_dimension_items.push(item);
                        result.items.push(item);
                        result.length++;
                        if(params.level > _this.max_column_level.value){
                            _this.max_column_level.field = mapping;
                            _this.max_column_level.value = params.level;
                        }
                    }
                }
            }
        }
    });
    if(result['length']){
        if(params.storage[params.level]){
            params.storage[params.level] = params.storage[params.level].concat(result['items']);
        }else{
            params.storage[params.level] = result['items'];
        }
    }
    return result;
};
AppGrid.prototype.outHtml = function(){
	var _this = this, number = 1, length = _this.def.columns.length;
	var table = $('<div class="agt-box" id="table-'+_this.def.id+'"></div>');
	if(_this.head_render === undefined){		
		_this.bars_render = $('<div class="agt-bars" id="bars-'+_this.def.id+'"></div>');
		_this.head_render = $('<div class="agt-head" id="head-'+_this.def.id+'"></div>');
		_this.foot_render = $('<div class="agt-foot" id="foot-'+_this.def.id+'"></div>');
	}else{
		_this.bars_render.empty();
		_this.foot_render.empty();
		_this.head_render.children('.agt-place').remove();
	}
	_this.render = {};
	$.each(_this.columns, function(key, column){
		var head_style = {}, body_style = {}, foot_style = {};
		_this.render[column.table_id] = {column: column};
		if(column.style){
			head_style = column.style.head ? column.style.head : null;
			body_style = column.style.body ? column.style.body : null;
			foot_style = column.style.foot ? column.style.foot : null;
			delete column.style.head;
			delete column.style.body;
			delete column.style.foot;
			head_style === null && (head_style = column.style);
			body_style === null && (body_style = column.style);
			foot_style === null && (foot_style = column.style);
		}
		
		var head_group = $('<colgroup/>');
		var head_thead = $('<thead class="app-grid-head-thead"/>');
		var head_table = $('<table class="agt agt-main agt-main-head" id="'+column.table_id+'-head"/>').append(head_group, head_thead, '<tbody class="app-grid-head-tbody"></tbody>');
		var head_block = $('<div class="agt-block agt-place-bar"/>').css(head_style).append(head_table);
		var head_place = $('<div class="agt-place" id="'+column.table_id+'-head-place"/>').css({'width':column.width > 0 ? column.width : 'auto', 'float': number == length ? 'none' : 'left'});
		head_place.append(head_block).appendTo(_this.head_render);
		_this.render[column.table_id].head = new BaseAppGrid({id: column.table_id + '-head', deliver: _this.def.deliver, setting: _this.def});
		_this.render[column.table_id].head_group = head_group;
		_this.render[column.table_id].head_thead = head_thead;
		_this.render[column.table_id].head_place = head_place;	
		
		var body_group = $('<colgroup/>');
		var body_tbody = $('<tbody class="app-grid-tbody"/>');
		var body_table = $('<table class="agt agt-main agt-main-body" id="'+column.table_id+'-body"/>').append(body_group, body_tbody);
		var body_block = $('<div class="agt-block agt-place-bar" id="'+column.table_id+'-body-bar"/>').css(body_style).append(body_table);
		var body_place = $('<div class="agt-place" id="'+column.table_id+'-body-place">').css({'width': column.width > 0 ? column.width : 'auto', 'float': number == length ? 'none' : 'left'});
		body_place.append(body_block).appendTo(table);
		_this.render[column.table_id].body = new BaseAppGrid({id: column.table_id + '-body', deliver: _this.def.deliver, setting: _this.def});
		_this.render[column.table_id].body_group = body_group;
		_this.render[column.table_id].body_tbody = body_tbody;
		_this.render[column.table_id].body_place = body_place;	
		
		var foot_group = $('<colgroup/>');
		var foot_tfoot = $('<tfoot class="app-grid-tfoot"/>');
		var foot_table = $('<table class="agt agt-main agt-main-foot" id="'+column.table_id+'-foot"/>').append(foot_group, foot_tfoot);
		var foot_block = $('<div class="agt-block agt-place-bar"/>').css(foot_style).append(foot_table);
		var foot_place = $('<div class="agt-place" id="'+column.table_id+'-foot-place">').css({'width': column.width > 0 ? column.width : 'auto', 'float': number == length ? 'none' : 'left'});
		foot_place.append(foot_block).appendTo(_this.foot_render);
		_this.render[column.table_id].foot = new BaseAppGrid({id: column.table_id + '-foot', deliver: _this.def.deliver, setting: _this.def});
		_this.render[column.table_id].foot_group = foot_group;
		_this.render[column.table_id].foot_tfoot = foot_tfoot;	
		_this.render[column.table_id].foot_place = foot_place;
				
		_this.render[column.table_id].bars_place = $('<div class="agt-place agt-bars-place" id="'+column.table_id+'-bars-place">').css({'width': column.width > 0 ? column.width : 'auto', 'float': number == length ? 'none' : 'left'});
		_this.render[column.table_id].bars_place.appendTo(_this.bars_render);
		number++;
	});
	_this.head_render.css({width: _this.width['grid']});
	_this.foot_render.css({width: _this.width['grid']});
	_this.bars_render.css({width: _this.width['grid']});
	var holder = $('<div class="agt-holder" id="holder-'+_this.def.id+'"></div>').append($('<div class="agt-area" id="area-'+_this.def.id+'"></div>').append(table));
	if(_this.body_render === undefined){		
		_this.body_render = $('<div class="agt-body" id="body-'+_this.def.id+'"></div>').css({width: _this.width['grid']}).append(holder);
		_this.grid['0'].innerHTML = '';
		_this.grid.addClass('app-grid');
		_this.def.toolbar.enable && _this.grid.append(_this.tool_holder = $('<div id="tool-'+_this.def.id+'" class="agt-tool"></div>').css({width: _this.width['grid']}));	
		_this.grid.append(_this.head_render, _this.body_render, _this.foot_render, _this.bars_render);
		_this.def.paginator.enable && _this.grid.append(_this.page_holder = $('<div class="agt-page" id="page-'+_this.def.id+'"></div>').css({width: _this.width['grid']}));
		_this.position.table = _this.grid.offset();
	}else{
		_this.body_render.empty().append(holder);
		_this.head_render.children('.agt-operate-place').appendTo(_this.head_render);
	}
	_this.init_fixed_height && holder.addClass('agt-holder-fixed').css({'max-height': _this.init_fixed_height, overflow: 'hidden'});
};
/**
 * 分段逻辑
 * @param height
 * @returns {Boolean}
 */
AppGrid.prototype.section = function(height){
	var data = {}, _this = this, length = _this.def.data.records;
	if(length == 0){
		return false;
	}
	if(height <= 0){			
		if(_this.height.tr.outerHeight == 0){
			data[0] = _this.def.data.records['0'];
			_this.def.data.records['1'] && (data[1] = _this.def.data.records['1']);
			$.each(_this.render, function(id, render){		
				render['body'].renderBody(data, render['column']['dimension_items'], render['body_tbody']);
				_this.height.tr.outerHeight = render['body_tbody'].find('tr:first').outerHeight();
				return false;
			});
		}
		if(_this.def.section.last_height == height){
			return false;
		}
		_this.def.section.buffer = Math.ceil(_this.def.section.height / _this.height.tr.outerHeight);		
		_this.def.section.last_height = height;
		_this.def.section.buffer_height = _this.def.section.buffer * _this.height.tr.outerHeight;
		_this.def.section.begin_index = 0;
		_this.def.section.end_index = _this.def.section.buffer * 2 - 1;
		data = _this.def.data.records.slice(0, _this.def.section.buffer * 2);
		$.each(_this.render, function(id, render){		
			render['body'].renderBody(data, render['column']['dimension_items'], render['body_tbody']);
		});
	}else{
		var diff_height = height - _this.def.section.last_height;
		if(Math.abs(diff_height) >= _this.def.section.buffer_height){
			_this.scroll_obj[_this.def.id].set('enable', false);
			var enable_render = false;
			if(diff_height > 0){				
				for(var i = 0; i < _this.def.section.buffer; i++){
					_this.def.section.end_index++;
					if(_this.def.data.records[_this.def.section.end_index]){
						enable_render = true;
						data[_this.def.section.end_index] = _this.def.data.records[_this.def.section.end_index];
					}
				}
				if(enable_render){				
					$.each(_this.render, function(id, render){		
						render['body'].renderBody(data, render['column']['dimension_items'], render['body_tbody'], 1);
					});
					_this.def.section.last_height += _this.def.section.buffer_height;
				}
			}else{
				_this.def.section.end_index -= _this.def.section.buffer;
				$.each(_this.render, function(id, render){	
					render['body_tbody'].find('#' + id + '-body-line-' + _this.def.section.end_index).nextAll().remove();
				});
				_this.def.section.last_height -= _this.def.section.buffer_height;
			}
			_this.scroll_obj[_this.def.id].set('enable', true);
		}
	}
};
AppGrid.prototype.renderer = function(){
	var _this = this;
	if(_this.def.section.enable){
		_this.def.section.last_height = null;
		_this.section(0);
		_this.scrollBar();
		_this.checkbox && data !== null && _this.changeHeadCheck(_this.def.data.records);
	}else{		
		var data = null;
		if(_this.def.paginator.enable && !_this.def.paginator.proxy){	
			while(!_this.def.paginator.data[_this.def.paginator.page_index] && _this.def.paginator.page_index > 1){
				_this.def.paginator.page_index--;
			}
			_this.def.paginator.data[_this.def.paginator.page_index] && (data = _this.def.paginator.data[_this.def.paginator.page_index]);
		}else{
			data = _this.def.data.records;
		}
		data !== null && $.each(_this.render, function(id, render){		
			render['body'].renderBody(data, render['column']['dimension_items'], render['body_tbody']);
			if(_this.height.tr.outerHeight == 0){
				_this.height.tr.outerHeight = render['body_tbody'].find('tr:first').outerHeight();
			}
		});	
		_this.scrollBar();
		_this.checkbox && data !== null && _this.changeHeadCheck(data);
	}
	if(_this.height.tr.outerHeight && _this.def.fixed.height){
		var content_height = _this.def.data.records.length * _this.height.tr.outerHeight;
		if(content_height != _this.scroll_obj[_this.def.id]['options']['content_height']){				
			_this.def.fixed.height = Math.min(content_height, _this.init_fixed_height);
			_this.scroll_obj[_this.def.id].set('height', {content_height: content_height});
		}
	}
	_this.scroll();
};
/**
 * 输出页头
 */
AppGrid.prototype.renderHead = function(){
    var _this = this;
    $.each(_this.render, function(id, render){
        render['head'].renderHeader(render);
    });
    _this.height['head'] = {outerHeight: _this.head_render.outerHeight()};
    _this.def.resize.enable && (_this.resize = new AppGridResize(_this));
    _this.def.sortable.enable && _this.sortable();
};
/**
 * 输出页体
 */
AppGrid.prototype.renderBody = function(){
    var _this = this;
    if(_this.def.data.records.length == 0){
        _this.def.empty.enable && _this.displayEmpty();
    }else{
        if(_this.empty_output_status){
            _this.def.columns = $.extend(true, [], _this.init_columns);
            _this.empty_copy_display !== undefined && (_this.def.data.display = _this.empty_copy_display);
            _this.empty_output_status = false;
            _this.empty_copy_display = undefined;
            _this.columns = [];
            _this.begin();
            _this.output();
        }
        _this.renderer();
    }

    if(_this.def.callback.afterRenderBody)
    {
        _this.def.callback.afterRenderBody.apply(_this,[_this.def.data.records]);   
    }
};
/**
 * 输出页脚，主要用于汇总
 */
AppGrid.prototype.renderFoot = function(){
	var _this = this;
	$.each(_this.render, function(id, render){
		render['foot'].renderFoot(_this.def.data.summary, render['column']['dimension_items'], render['foot_tfoot']);
	});
};
/**
 * 输出空
 */
AppGrid.prototype.displayEmpty = function(){
	var _this = this;
	if(_this.empty_output_status !== true){
		if(_this.def.columns.length > 1){
			for(var i = 1, l = _this.def.columns.length; i < l; i++){
				_this.def.columns[0].items = _this.def.columns[0].items.concat(_this.def.columns[i].items);
			}
			_this.def.columns[0].frozen = false;
			_this.def.columns = [_this.def.columns[0]];
			delete _this.def.columns[0].style;
		}
		if(_this.def.empty.display !== null){
			_this.empty_copy_display = $.extend(true, {}, _this.def.data.display);
			_this.def.data.display = _this.def.empty.display;
		}
		_this.columns = [];
		_this.begin();
		_this.output();
	}
	$.each(_this.render, function(id, render){
		render['body'].renderEmpty(_this.items_length, render['body_tbody'], _this.def.empty.text);
	});
	_this.checkbox && _this.changeHeadCheck([]);
	_this.empty_output_status = true;
	_this.scrollBar();
	_this.scroll();
};
/**
 * 改变表头选中框
 * @param data
 */
AppGrid.prototype.changeHeadCheck = function(records){
    var _this = this, length = records.length, checked = 0;
    if(length == 0){
        _this.checkbox.set('head', 'unchecked');
    }else{
        $.each(records, function(index, record){
            if(record['checkbox'] && record['checkbox']['state'] == 'checked'){
                checked++;
            }
        });
        if(length == checked){
            _this.checkbox.set('head', 'checked');
        }else{
            if(checked == 0){
                _this.checkbox.set('head', 'unchecked');
            }else{
                _this.checkbox.set('head', 'half');
            }
        }
    }
};
/**
 * 刷新单格数据
 */
AppGrid.prototype.refreshColumn = function(field, index){
	var record = this.get.record(index);
	if(record[field]){
		var column = this.field_to_items[field], table_id = column['table_id'], render = this.render[table_id];
		render['body'].refreshBodyColumn(column, record, index, render['body_tbody']);
	}
};
/**
 * 刷新单行数据
 */
AppGrid.prototype.refreshLine = function(index){
	var record = this.get.record(index);
	$.each(this.render, function(id, render){		
		render['body'].refreshBodyLine(render['column']['dimension_items'], record, index, render['body_tbody']);
	});	
};
/**
 * TODO 刷新范围数据
 */
AppGrid.prototype.refreshRangeLine = function(start, end){

};
/**
 * 生成滚动条
 */
AppGrid.prototype.scrollBar = function(){
	var _this = this;
	$.each(_this.render, function(id, render){
		if(render['column'].frozen !== true){
			if(_this.scroll_obj[id]){
				_this.scroll_obj[id].update(_this.scroll_update_status);
			}else{
				_this.scroll_obj[id] = new AppGridBar({
					target: '#'+id+'-body-place',
					render: '#'+id+'-bars-place',
					enablewheel: _this.def.scrollbar.mousewheelX,
					wheel: _this.def.scrollbar.wheel == 0 ? _this.height.tr.outerHeight : _this.def.scrollbar.wheel,
					sync: [render['head_thead'].parent(), render['foot_tfoot'].parent()],
					callback: function(data){
						_this.def.scrollbar.callback && _this.def.scrollbar.callback.call(null, id, data);
					}
				}, _this);
			}
		}
	});
	if(_this.def.fixed.height){
		if(_this.scroll_obj[_this.def.id]){
			_this.scroll_obj[_this.def.id].update(_this.scroll_update_status);
		}else{	
			if(_this.empty_output_status !== true){				
				var config = {
					target: '#body-' + _this.def.id,
					render: '#body-' + _this.def.id,
					axis: 'y',
					place: '.agt-holder',
					content: '.agt-area',
					enablewheel: _this.def.scrollbar.mousewheelY,
					wheel: _this.def.scrollbar.wheel == 0 ? _this.height.tr.outerHeight : _this.def.scrollbar.wheel,					
					callback: function(data){
						_this.def.section.enable && _this.section(-data.content);
						_this.def.scrollbar.callback && _this.def.scrollbar.callback.call(null, _this.def.id, data);
					}
				};
				if(_this.def.section.enable){
					config.place_height = _this.def.section.height;
					config.content_height = _this.def.data.records.length * _this.height.tr.outerHeight;
				}
				_this.scroll_obj[_this.def.id] = new AppGridBar(config, _this);
			}
		}
	}
	_this.scroll_update_status = false;
};
AppGrid.prototype.scroll = function(){
    var _this = this;
    if(_this.def.fixed.head || _this.def.fixed.scroll){
        _this.axisXScroll();
    }
    _this.doAxisXScroll($(window));
};
AppGrid.prototype.axisXScroll = function(){
    var _this = this;
    APP_GRID_GLOBAL_OBJECT.scroll_and_resize['holder'][_this.def.id] = _this;
    if(!APP_GRID_GLOBAL_OBJECT.scroll_and_resize['func']){
        APP_GRID_GLOBAL_OBJECT.scroll_and_resize['func'] = {
                scroll: function(){
                    var w = $(window);
                    $.each(APP_GRID_GLOBAL_OBJECT.scroll_and_resize['holder'], function(id, obj){
                        obj.position.table = obj.grid.offset();
                        if(obj.def.section.enable && obj.def.section.height == 0){
                            var start = w.scrollTop() - obj.position.table.top;
                            start > 0 && obj.section(start);
                        }
                        obj.doAxisXScroll(w);
                    });
                },
                resize: function(){
                    var w = $(window);
                    $.each(APP_GRID_GLOBAL_OBJECT.scroll_and_resize['holder'], function(id, obj){
                        obj.position.table = obj.grid.offset();
                        obj.doAxisXScroll(w);
                    });
                }
        };
        var win = $(window);
        win.bind('scroll', APP_GRID_GLOBAL_OBJECT.scroll_and_resize['func']['scroll']);
        win.bind('resize', APP_GRID_GLOBAL_OBJECT.scroll_and_resize['func']['resize']);
    }
};
AppGrid.prototype.doAxisXScroll = function(win){
    var _this = this;
    if(_this.position.table && _this.empty_output_status !== true){
        var height = _this.grid.height(), window_top = win.scrollTop(), window_height = win.height();
        if(_this.def.fixed.head || _this.def.fixed.toolbar){
            var start = window_top - _this.position.table.top;
            var limit = start  + _this.height.tr.outerHeight - height;
            if(_this.def.fixed.toolbar){
                limit += _this.height.toolbar.outerHeight;
            }
            if(_this.def.fixed.head){
                limit += _this.height.head.outerHeight;
            }
            if(_this.def.paginator.enable){
                limit += _this.height.paginator.outerHeight;
            }
            if(start > 0 && limit < 0){
                if(_this.def.fixed.head && !_this.head_clone){
                    _this.head_clone = _this.head_render.clone().empty().removeAttr('id').css({height: _this.height.head.outerHeight});
                    _this.head_render.before(_this.head_clone);
                    _this.head_render.css({top: _this.def.fixed.toolbar ? _this.height.toolbar.outerHeight : 0, left: _this.position.table.left, position: 'fixed', 'z-index': 6});
                }
                if(_this.def.fixed.toolbar && !_this.toolbar_clone){
					_this.toolbar_clone = _this.tool_holder.clone().removeAttr('id');
                    _this.toolbar_clone.prependTo(_this.grid);
					_this.def.fixed.toolbar && _this.tool_holder.css({top: 0, left: _this.position.table.left, position: 'fixed', 'z-index': 7});
                }
            }else{
                _this.toolbar_clone && _this.toolbar_clone.remove() && (_this.toolbar_clone = null);
                _this.head_clone && _this.head_clone.remove() && (_this.head_clone = null);
                _this.def.fixed.head && _this.head_render.css({top: 0, left: 0, position: 'relative', 'z-index': 5});
				_this.def.fixed.toolbar && _this.tool_holder.css({top: 0, left: 0, position: 'relative', 'z-index': 6});
            }
        }
        if(_this.def.fixed.scroll){
            var show = window_top + window_height - _this.position.table.top - _this.height.tr.outerHeight - _this.height.head.outerHeight - _this.height.toolbar.outerHeight;
            var hide = window_top + window_height - _this.position.table.top - height;
            _this.height.paginator && (hide += _this.height.paginator.outerHeight);
			if(show > 0 && hide < 0){	
				_this.bars_render.css({position: 'fixed', left: _this.bars_render.offset().left, bottom: 0});
			}else{
				_this.bars_render.css({position: 'relative', left: 0, bottom: 'auto'});
			}
		}
	}
};
AppGrid.prototype.hover = function(){
	var _this = this;
	if(_this.def.hover.enable){
		_this.grid.appGridHoverClass('.agt-col', 'agt-col-hover', function(target){
			var field = target.attr('_field'), parent = target.parent(), table = parent.attr('_table_id'), line = parent.attr('_index');
			_this.def.hover.x_axis && _this.body_render.find('.agt-line[_index="'+line+'"]').addClass('agt-line-hover');
			_this.def.hover.y_axis && $('#' + table).find('.agt-col[_field="'+field+'"]').addClass('agt-col-row-hover');
		}, function(target){
			var field = target.attr('_field'), parent = target.parent(), table = parent.attr('_table_id'), line = parent.attr('_index');
			_this.def.hover.x_axis && _this.body_render.find('.agt-line[_index="'+line+'"]').removeClass('agt-line-hover');
			_this.def.hover.y_axis && $('#' + table).find('.agt-col[_field="'+field+'"]').removeClass('agt-col-row-hover');
		});
	}
};
AppGrid.prototype.reCalculatePaginator = function(){
    var _this = this;
    if(_this.def.paginator.enable && !_this.def.paginator.proxy){
        var index = 1, size = 1;
        _this.def.paginator.data = {};
        $.each(_this.def.data.records, function(k, v){
            !_this.def.paginator.data[index] && (_this.def.paginator.data[index] = []);
            _this.def.paginator.data[index].push(v);
            size == _this.def.paginator.page_size ? (index++ && (size = 1)) : (size++);
        });
    }
};
/**
 * get方法集合
 */
var AppGridGet = function(_this){
    this._this = _this;
};
AppGridGet.prototype.item = function(index, field){
    var record = this.record(index);
    return record && record[field] ? record[field] : null;
};
AppGridGet.prototype.record = function(index){
    var records = this.records();
    return records[index] ? records[index] : null;
};
AppGridGet.prototype.rangeRecords = function(start, end){
    var result = {}, records = this.records();
    for(;start <= end; start++){
        result[start] = records[start];
    }
    return result;
};
AppGridGet.prototype.records = function(){
	if(this._this.def.paginator.enable && !this._this.def.paginator.proxy && this._this.def.paginator.data){	
		return this._this.def.paginator.data[this._this.def.paginator.page_index]; 
	}else{
		return this._this.def.data.records;
	}
};
AppGridGet.prototype.summary = function(){
	return this._this.def.data.summary || [];
};
AppGridGet.prototype.checked = function(){
    if(this._this.def.checkbox.enable){
        return this._this.checkbox.get();
    }else{
        return {index: [], records: {}};
    }
};
AppGridGet.prototype.display = function(){
    return this._this.def.data.display;
};
AppGridGet.prototype.scroll = function(){
    var res = {};
    $.each(this._this.scroll_obj, function(index, scroll){
        res[index] = scroll.get('position');
    });
    return res;
};
AppGridGet.prototype.index = function(field, value, total){
    var index = total === true ? [] : '';
    $.each(this._this.def.data.records, function(key, record){
        if(record[field] && record[field]['value'] == value){
            if(total === true){
                index.push(key);
            }else{
                index = key;
                return false;
            }
        }
    });
    return index;
};
/**
 * set方法集合
 */
var AppGridSet = function(_this){
    this._this = _this;
};
AppGridSet.prototype.scroll = function(scroll){
    var grid = this._this;
    $.each(scroll, function(index, params){
        if(grid.scroll_obj[index]){
            grid.scroll_obj[index].set('position', params);
        }
    });
};
AppGridSet.prototype.item = function(index, field, item){
    if(this._this.def.data.records[index] && this._this.def.data.records[index][field]){
        this._this.def.data.records[index][field] = item;
        if(this._this.def.data.records[index]['reverse_index'] && this._this.def.data.records[index]['reverse_index']['record_init_index'] !== undefined){
            var record_init_index = this._this.def.data.records[index]['reverse_index']['record_init_index'];
            this._this.init_records[record_init_index][field] = item;
        }
    }
};
AppGridSet.prototype.record = function(index, record){
    if(this._this.def.data.records[index]){
        this._this.def.data.records[index] = record;
        if(this._this.def.data.records[index]['reverse_index'] && this._this.def.data.records[index]['reverse_index']['record_init_index'] !== undefined){
            var record_init_index = this._this.def.data.records[index]['reverse_index']['record_init_index'];
            this._this.init_records[record_init_index] = record;
        }
    }
};
AppGridSet.prototype.records = function(records, init){
    var _this = this._this, page_index = 1, page_size = 1, row = {}, i = 0, index_to_field = [].concat(['checkbox'], _this.index_to_field);
    _this.def.data.records = [];
    _this.def.paginator.data = {};
    records && $.each(records, function(k, record){
        if(_this.def.colspan.enable || _this.def.rowspan.enable){
            var col = {};
            $.each(index_to_field, function(idx, field){
                var item = record[field];
                if(item === null || typeof item != 'object'){
                    return true;
                }
                if(_this.def.colspan.enable && _this.field_to_items[field].colspan){
                    if(item.colspan === undefined){
                        if(col.value === item.value){
                            item.colspan = true;
                            record[col.field].colspan++;
                        }else{
                            col = {field: field, value: item.value};
                            item.colspan = 1;
                        }
                    }
                }else{
                    item.colspan = false;
                }
                if(_this.def.rowspan.enable && _this.field_to_items[field].rowspan){
                    if(item.rowspan === undefined){
                        var temp = row[field];
                        if(temp && temp.value === item.value &&temp.next === i){
                            item.rowspan = true;
                            _this.def.data.records[temp.index][field].rowspan++;
                            temp.next++;
                        }else{
                            row[field] = {index: i, value: item.value, next: i + 1};
                            item.rowspan = 1;
                        }
                    }
                }else{
                    item.rowspan = false;
                }
            });
        }
        if(_this.def.checkbox.enable){
            if(!record['checkbox']){
                record['checkbox'] = {state: 'unchecked'};
            }else{
                if(!record['checkbox']['state']){
                    record['checkbox']['state'] = 'unchecked';
                }
            }
        }
        if(_this.def.paginator.enable && !_this.def.paginator.proxy){
            !_this.def.paginator.data[page_index] && (_this.def.paginator.data[page_index] = []);
            _this.def.paginator.data[page_index].push(record);
            page_size == _this.def.paginator.page_size ? (page_index++ && (page_size = 1)) : (page_size++);
        }
        if(record['reverse_index'] == undefined){
            record['reverse_index'] = {};
        }
        record['reverse_index']['record_init_index'] = i;
        _this.def.data.records.push(record);
        i++;
    });
    if(_this.def.paginator.enable && !_this.def.paginator.proxy){
        this.total(i);
    }
    _this.init_records = [].concat(_this.def.data.records);
};
AppGridSet.prototype.total = function(total){
    this._this.def.data.total = total;
    this._this.paginator && this._this.paginator.set('total', total);
};
AppGridSet.prototype.summary = function(records){
    this._this.def.data.summary = records ? records : [];
};
AppGridSet.prototype.display = function(display, init){
    var _this = this._this;
    init !== false && (_this.init_items = null);
    _this.def.data.display = display;
    _this.begin();
    _this.refreshOutPut();
    _this.scroll_update_status = true;
    _this.renderHead();
    _this.renderBody();
    _this.renderFoot();
};
AppGridSet.prototype.hide = function(hide, init){
    var _this = this._this;    
    var display = {};
    $.each(_this.def.columns, function(key, column){
        $.each(column.items,function(ckey,item){
            if(!hide[item.mapping[0]] || hide[item.mapping[0]]!==true)
            {
                display[item.mapping[0]] = true;
            }
        });
    });
    _this.set.display(display,init);
};

/**
 * 表格控件
 */
String.prototype.appGridFormat = function(config, reserve){return this.replace(/\{([^}]+)\}/g, (typeof config == 'object') ? function(m, i) {var ret = config[i];if(ret == null && reserve){return m;}return ret;}: config);};
String.prototype.appGridNumber = function(dig){var arr = this.split('.');arr[0] = arr[0].replace(/(\d)(?=(\d{3})+(\.\d+)?$)/g, '$1,');if(!dig){return arr.join('.');}arr[1] = ((arr[1] || '') + '0'.repeat(dig)).substring(0, dig);return arr.join('.');};
Number.prototype.appGridNumber = function(dig){if(dig){var p = (10).pow(dig);return ('' + (this * p).round() / p).appGridNumber(dig);}else{return ('' + this).appGridNumber();}};
String.prototype.filterHtml = function(){var tmp = document.createElement("div");tmp.innerHTML = this;return tmp.textContent || tmp.innerText;};
jQuery.fn.extend({
    appGridHoverClass: function(tag, cls, ent, lea) {
        !cls && (cls = tag);
        var enter = function() {$(this).addClass(cls); ent && ent.call(null, $(this));}, leave = function() {$(this).removeClass(cls);lea && lea.call(null, $(this));};
        if (arguments.length == 1) {return this.hover(enter, leave);}
        return this.delegate(tag, 'mouseenter', enter).delegate(tag, 'mouseleave', leave);
    }
});
var APP_GRID_GLOBAL_OBJECT = {
    style: function(styles){
        var ret = [];
        $.each(styles, function(k, v) {
            v && ret.push(k + ':' + v);
        });
        return ret.join(';');
    },
    add: function(a, b){
        var c, d, e;
        try {
            c = a.toString().split(".")[1].length;
        } catch (f) {
            c = 0;
        }
        try {
            d = b.toString().split(".")[1].length;
        } catch (f) {
            d = 0;
        }
        return e = Math.pow(10, Math.max(c, d)), (this.mul(a, e) + this.mul(b, e)) / e;
    },
    mul: function(a, b){
        var c = 0, d = a.toString(), e = b.toString();
        try {
            c += d.split(".")[1].length;
        } catch (f) {

        }
        try {
            c += e.split(".")[1].length;
        } catch (f) {

        }
        return Number(d.replace(".", "")) * Number(e.replace(".", "")) / Math.pow(10, c);
    },
    callback: function(func, time){
        if(time > 0){
            return setTimeout(func, time);
        }else{
            if (window.msSetImmediate){
                return msSetImmediate(func);
            } else if (window.MozSetImmediate){
                return MozSetImmediate(func);
            } else if (window.WebkitSetImmediate){
                return WebkitSetImmediate(func);
            } else if (window.OSetImmediate){
                return OSetImmediate(func);
            } else {
                return setTimeout(func, 0);
            }
        }
    },
    clear: function(evt) {
        if (evt.stopPropagation){
            evt.stopPropagation();
        }else{
            evt.cancelBubble = true;
        }
        if (evt.preventDefault){
            evt.preventDefault();
        }else{
            evt.returnValue = false;
        }
    },
    generate: (function(pre) {
        var id = 1;
        return function(pre) {
            return (pre || '') + '_generate_' + id++;
        };
    })(),
    html: (function() {
        var div = document.createElement("div");
        return function(str){
            div.innerHTML = '';
            div.appendChild(document.createTextNode(str));
            return div.innerHTML;
        };
    })(),
    toJson: function(o){
        return JSON.stringify(o, function(key, value){
            if(typeof value == 'string' || typeof value == 'number'){
                return value + "";
            }else{
                return value;
            }
        });
    },
    scroll_and_resize: {holder: {}},
    default_config: {
        id: 'app-grid',
        columns: [],
        deliver: {},
        itemwidth: 100,
        data: {records: [], display: null, total: 0, summary: []},
        drag: {enable: false, status: true, handle: '.agt-col-drag', callback: null},
        empty: {enable: true, text: '暂无数据', display: null},
        fixed: {head: true, toolbar: false, scroll: true, height: 0},
        hover: {enable: false, x_axis: false, y_axis: false},
		resize: {enable: false, handle: '.agt-th-resize', onresize: null, onstop: null, type: '1', storage: false},
        section: {enable: false, height: 400},
        rowspan: {enable: false},
        colspan: {enable: false},
        serverSide:{
            enable:false,
            paginator:{
                enable: true,
                page_index: 1, 
                page_size: 5, 
                page_items: [
                    {value: 5, text: '5条'}, 
                    {value: 20, text: '20条'}, 
                    {value: 50, text: '50条'}
                ]
            },
            sortable:{
                enable:true,
                sort_field:'Fid',
                sort_asc:'desc'
            },
            url:'',
            method:'get',
            condition:null
        },
        sortable: {enable: false, sort_field: 'id', sort_asc: 'desc', proxy: null},
        scrollbar: {mousewheelX: false, mousewheelY: true, callback: null, wheel: 0},
        paginator: {enable: false, proxy: null, page_index: 1, page_size: 10, page_items: [{value: 10, text: '10条'}, {value: 20, text: '20条'}, {value: 30, text: '30条'}]},
        itemsoperate: {enable: false, callback: null},
        toolbar: {
            enable: false,
            exportexcel: {
                enable: false,
                text: '<span class="agt-icon agti-export agt-rt2"></span>导出Excel',
                title: '导出Excel',
                excelfilename: 'download',
                exceltitlename: '',
                excelsheetname: 'Sheet1',
                colspan: true,
				rowspan: true,
				unableexport: null,
                before:false,
                after:false
            },
            remove: {
                enable: false,
                text: '<span class="agt-icon agti-del agt-rt2"></span>删除',
                title: '删除',
                callback: null
            },
            setting: {
                enable: false,
                storage: false,
                draggable: false,
                text: '<span class="agt-icon agti-set agt-rt2"></span>自定义列',
				title: '自定义列',
				callback: null
            },
            unfilter: {
                enable: false,
                text: '<span class="agt-icon agti-unfilter agt-rt2"></span>清除筛选',
                title: '清除筛选'
            },
            linecharts: {
                enable: false,
                text: '<span class="agt-icon agti-line-chart agt-rt2"></span>拆线图',
                title: '拆线图'
            },
            barcharts: {
                enable: false,
                text: '<span class="agt-icon agti-bar-chart agt-rt2"></span>柱状图',
                title: '柱状图'
            },
            piecharts: {
                enable: false,
                text: '<span class="agt-icon agti-pie-chart agt-rt2"></span>饼图',
                title: '饼图'
            },
            custom: {}
        },
        checkbox: {enable: false, callback: null, position: 0, item: {
            title: '<span class="agti-check-column agt-icon agti-check" _index="-1"></span>',
            mapping: ['checkbox'],
            width: 40,
            renderer: function(checkbox){
                if(checkbox && checkbox.item){
                    switch(checkbox.item.state){
                        case 'checked':
                            return '<span class="agti-check-column agt-icon agti-check agti-checked" _index="'+checkbox.index+'"></span>';
                        case 'disabled':
                            return '<span class="agti-check-column agt-icon agti-check agti-check-disabled" _index="'+checkbox.index+'"></span>';
                        case 'locked':
                            return '<span class="agti-check-column agt-icon agti-check agti-check-locked" _index="'+checkbox.index+'"></span>';
                        case 'half':
                            return '<span class="agti-check-column agt-icon agti-check agti-check-half" _index="'+checkbox.index+'"></span>';
                        default:
                            return '<span class="agti-check-column agt-icon agti-check" _index="'+checkbox.index+'"></span>';
                    }
                }else{
                    return '';
                }
            }
        }},
        selection: {
            enable: false,
            mouse: 'left',
            toolbar: {
                num: true,
                sum: true,
                avg: true,
                barcharts: false,
                piecharts: false,
                linecharts: false,
                exportexcel: false,
                custom: {}
            }
        },
        callback:{
            afterRenderBody:undefined
        },
        styles:{
            th:{'font-weight':'bold'}
        }
    }
};
var BaseAppGrid = function(config){
    this.id = config.id;
    this.deliver = config.deliver;
    this.setting = config.setting;
};
BaseAppGrid.prototype.renderHeader = function(render) {
    var _this = this, colgroup = [], thead = [], column = render['column'], max_column_level = column['max_column_level'], items = column['items'];
    $.each(column['dimension_items'], function(index, item){
        var mapping = item.mapping['0'];
        colgroup.push('<col _field="{field}" style="{style}" />'.appGridFormat({
            'field': mapping,
            'style': APP_GRID_GLOBAL_OBJECT.style({'width': item.width > 0 ? (item.width + 'px') : ''})
        }));
    });
    for(var i = 1; i <= max_column_level; i++){
        thead.push('<tr class="agt-line">');
        items[i] && $.each(items[i], function(index, item){
            var class_name = 'agt-th ' + (item['class'] || ''), text = '<div class="agt-th-con"> ' + item.title;
            i > 1 && (class_name += ' agt-levels');
            if(item.length){
                thead.push('<th style="{style}" colspan="{colspan}" class="{classname}">{text}</th>'.appGridFormat({
                    'text': text + '</div>',
                    'colspan': item.length,
                    'style': APP_GRID_GLOBAL_OBJECT.style($.extend(_this.setting.styles.th,item.style && item.style.th ? item.style.th : {})),
                    'classname': class_name
                }));
            }else if(item.mapping && item.mapping['0']){
                var mapping = item.mapping['0'];
                if(item.sortable && _this.setting.sortable.enable){
                    text += '<span _field="' + mapping + '" class="agt-icon agti-sort"></span>';
                    class_name += ' grid-sortable sort-asc sort-unvisible';
                }
                if(_this.setting.itemsoperate.enable && item.operate && item.operate.enable){
                    text += '<span _field="' + mapping + '" class="agt-icon agti-operate agt-th-operate"></span>';
                }
                item.resize && item.resize.enable && (class_name += ' agt-th-resize');
                thead.push('<th style="{style}" _table_id="{tableid}" id="{id}" rowspan="{rowspan}" class="{classname}" _field="{field}">{text}</th>'.appGridFormat({
                    'id': (_this.id + '-' + mapping),
                    'text': text + '</div>',
                    'field': mapping,
                    'rowspan': (max_column_level - i + 1),
                    'style': APP_GRID_GLOBAL_OBJECT.style($.extend(_this.setting.styles.th,item.style && item.style.th ? item.style.th : {})),
                    'tableid' : _this.id,
                    'classname': class_name
                }));
            }
        });
        thead.push('</tr>');
    }
    render['head_group'].empty().append(colgroup.join(''));
    render['head_thead'].empty().append(thead.join(''));
	render['body_group'].empty().append(colgroup.join(''));
	render['foot_group'].empty().append(colgroup.join(''));
};
BaseAppGrid.prototype.getColumn = function(column, item, index, cls) {
    var _this = this, field = column.mapping[0];
    var colspan = (item[field] && item[field].colspan) || 1;
    var rowspan = (item[field] && item[field].rowspan) || 1;
    var classname = (item[field] && item[field].classname) ? item[field].classname : '';
    if(rowspan === true || colspan === true){
        return '';
    }else{
        cls = cls || '';
        rowspan > 1 && (cls += ' rowspan');
        colspan > 1 && (cls += ' colspan');
        column.drag && (cls += ' agt-col-drag');
        return '<td style="{style}" class="agt-col agt-col-{field} {cls} {classname}" rowspan="{rowspan}" colspan="{colspan}" _field="{field}">'.appGridFormat({
            'cls' : cls,
            'rowspan': rowspan,
            'colspan': colspan,
            'classname': classname,
            'style': APP_GRID_GLOBAL_OBJECT.style($.extend({}, column.style && column.style.td ? column.style.td : {}, item[field] && item[field]['style'] ? item[field]['style'] : {})),
            'field' : field
        })  + _this.getColumnHtml(column, item, index) + '</td>';
    }
};
BaseAppGrid.prototype.getColumnHtml = function(column, item, index){
    var _this = this;
    if(typeof column.renderer == 'function')
    {
        var params = $.map(column.mapping, function(mapping) {
            return {item: item[mapping], index: index, deliver: _this.deliver, id: _this.id, table_name: column.name};
        });
        params.push(item);
        return column.renderer.apply(null, params);
    }
    else
    {
        return _this.commonRender(item, column);
    }
};
BaseAppGrid.prototype.commonRender = function(item, column){
    var mapping = column.mapping[0], text = item[mapping] && item[mapping].text !== undefined ? item[mapping].text : '';
    return '<div class="agt-col-cont" title="'+text+'">'+text+'</div>';
};
BaseAppGrid.prototype.refreshBodyColumn = function(column, item, index, tbody){
    var field = column.mapping[0], line = tbody.find('#'+this.id+'-line-'+index);
    line.find('.agt-col-' + field).empty().append(this.getColumnHtml(column, item, index));
};
BaseAppGrid.prototype.refreshBodyLine = function(columns, item, index, tbody){
    var _this = this, id = _this.id+'-line-'+index, tr = tbody.find('#' + id), td = '', table_name = columns['0']['name'], rowclass = '';
    if(item['row_class_name'] && item['row_class_name']['class_name']){
        rowclass = item['row_class_name']['class_name'][table_name] || '';
    }
    $.each(columns, function(c, column){
        td += _this.getColumn(column, item, index);
    });
    tr.removeClass().addClass('agt-line ' + rowclass).empty().append(td);
};
BaseAppGrid.prototype.renderBody = function(items, columns, tbody, type) {
    var _this = this, tr = '', table_name = columns['0']['name'];
    $.each(items, function(key, item) {
        var rowclass = '';
        if(item['row_class_name'] && item['row_class_name']['class_name']){
            rowclass = item['row_class_name']['class_name'][table_name] || '';
        }
        tr += '<tr _table_id="'+_this.id+'" id="'+_this.id+'-line-'+key+'" class="agt-line '+rowclass+'" _index="'+key+'">';
        $.each(columns, function(c, column){tr += _this.getColumn(column, item, key);});
        tr += '</tr>';
    });
    switch(type){
        case 1:
            tbody.append(tr);
            break;
        case 2:
            tbody.prepend(tr);
            break;
        default:
            tbody.empty().append(tr);
    }
};
BaseAppGrid.prototype.renderEmpty = function(items_length, tbody, text){
    tbody.empty().append("<tr class='agt-line'><td class='agt-col' colspan='"+items_length+"'>"+text+"</td></tr>");
};
BaseAppGrid.prototype.renderFoot = function(items, columns, tfoot){
    var _this = this, tr = '';
	items && items.length && $.each(items, function(key, item) {
        tr += '<tr>';
        $.each(columns, function(c, column){
            tr += _this.getColumn(column, item, key, 'agc-tfoot');
        });
        tr += '</tr>';
    });
    tfoot.empty().append(tr);
};

/**
*
*一些方法
*/
var AppGridAction = {

    remove: function(index){
        var next = null, records = grid.get.records();
        index.sort();
        while(next = index.pop()){
            var record = records[next];
            if(record){
                var record_init_index = record['reverse_index']['record_init_index'];
                grid.init_records.splice(record_init_index, 1);
            }
        }
        //清除所有筛选条件
        grid.item_operate && (grid.item_operate.holder = {});
        //重新赋完整的值
        grid.set.records(grid.init_records);
        grid.renderBody();
    },
    exportExcel: function(grid){
        var checked = grid.get.checked();
        if(checked.index.length){
            var dialog = new AppGridDialog({
                title: grid.def.toolbar.exportexcel.text.filterHtml(),
                content: '<div id="app-grid-export-excel-block" style="padding:20px;"></div>'
            });
            var default_export_type = '1';
            new AppGridUtilityR({
                render: '#app-grid-export-excel-block',
                style: 'margin-right:10px;display:inline-block;cursor:pointer;',
                items: [{value: '1', text: '导出列表所有数据'}, {value: '2', text: '导出列表选中数据'}],
                value: {value: default_export_type},
                callback: function(item){
                    default_export_type = item.value;
                }
            });
            dialog.render.find('.agt-dialog-cancel, .agt-dialog-close').click(function(){
                dialog.close();
            });
            dialog.render.find('.agt-dialog-confirm').click(function(){
                typeof grid.def.toolbar.exportexcel.before == 'function' && grid.def.toolbar.exportexcel.before.apply(grid);
                if(default_export_type == '1'){
                    var excel = new AppGridExcel();
                    var xls = excel.createGridExcel(grid);
					new AppGridFileSave(xls, grid.def.toolbar.exportexcel.excelfilename + ".xls", null,  grid.def.toolbar.exportexcel.unableexport);
                }else{
                    var excel = new AppGridExcel();
					var xls = excel.createGridExcel(grid, {records: checked.records, summary:[]});
					new AppGridFileSave(xls, grid.def.toolbar.exportexcel.excelfilename + ".xls", null,  grid.def.toolbar.exportexcel.unableexport);
                }
                dialog.close();
                typeof grid.def.toolbar.exportexcel.after == 'function' && grid.def.toolbar.exportexcel.after.apply(grid);
            });
        }else{
            typeof grid.def.toolbar.exportexcel.before == 'function' && grid.def.toolbar.exportexcel.before.apply(grid);
            var excel = new AppGridExcel();
            var xls = excel.createGridExcel(grid);
            new AppGridFileSave(xls, grid.def.toolbar.exportexcel.excelfilename + ".xls", null,  grid.def.toolbar.exportexcel.unableexport,grid);
            typeof grid.def.toolbar.exportexcel.after == 'function' && grid.def.toolbar.exportexcel.after.apply(grid);
        }
    },
    exportExcelSelection: function(grid, extend){
        typeof grid.def.toolbar.exportexcel.before == 'function' && grid.def.toolbar.exportexcel.before.apply(grid);
        var excel = new AppGridExcel();
        var xls = excel.createGridExcel(grid, extend);
		new AppGridFileSave(xls, grid.def.toolbar.exportexcel.excelfilename + ".xls", null,  grid.def.toolbar.exportexcel.unableexport);
        typeof grid.def.toolbar.exportexcel.after == 'function' && grid.def.toolbar.exportexcel.after.apply(grid);
    },
    linechart: function(grid, params){
        var dialog = new AppGridDialog({
            title: grid.def.toolbar.linecharts.text.filterHtml(),
            style: {width: '60%'},
            content: '<div id="app-grid-chart-block"></div>',
            cancel_txt: ''
        });
        dialog.render.find('.agt-dialog-confirm, .agt-dialog-close').click(function(){
            dialog.close();
        });
        new DrawCharts({info: params.charts_data.data, columns: params.charts_data.columns, type: ['spline'], div: 'app-grid-chart-block'});
        dialog.relocate(true);
    },
    piechart: function(grid, params){
        var dialog = new AppGridDialog({
            title: grid.def.toolbar.piecharts.text.filterHtml(),
            style: {width: '60%'},
            content: '<div id="app-grid-chart-block"></div>',
            cancel_txt: ''
        });
        dialog.render.find('.agt-dialog-confirm, .agt-dialog-close').click(function(){
            dialog.close();
        });
        new DrawCharts({info: params.charts_data.data, columns: params.charts_data.columns, type: ['pie'], div: 'app-grid-chart-block'});
        dialog.relocate(true);
    },
    barchart: function(grid, params){
        var dialog = new AppGridDialog({
            title: grid.def.toolbar.barcharts.text.filterHtml(),
            style: {width: '60%'},
            content: '<div id="app-grid-chart-block"></div>',
            cancel_txt: ''
        });
        dialog.render.find('.agt-dialog-confirm, .agt-dialog-close').click(function(){
            dialog.close();
        });
        new DrawCharts({info: params.charts_data.data, columns: params.charts_data.columns, type: ['column'], div: 'app-grid-chart-block'});
        dialog.relocate(true);
    }
};

//复选框逻辑
var AppGridCheckbox = function(grid){
    this.grid = grid;
	this.table = $('#body-' + grid.def.id);
    this.head = $('#head-' + grid.def.id);
    var _this = this, shift_key_check = {column: null, state: ''};
    _this.table.off('click', '.agti-check-column').on('click', '.agti-check-column', function(e){
        var _t = $(this), _index = _t.attr('_index');
        var records = grid.get.records(), current_checkbox = records[_index]['checkbox'], rowspan = current_checkbox['rowspan'] ? Number(current_checkbox['rowspan']) : 1;
        switch(current_checkbox['state']){
            case 'disabled':
            case 'locked':
                return false;
                break;
            case 'half':
                _t.removeClass('agti-check-half').addClass('agti-checked');
                current_checkbox.state = 'checked';
                break;
            case 'checked':
                _t.removeClass('agti-checked');
                current_checkbox.state = 'unchecked';
                break;
            default:
                _t.addClass('agti-checked');
                current_checkbox.state = 'checked';
        }
        var loop_start_index = Number(_index);
        while(--rowspan > 0){
            records[++loop_start_index]['checkbox']['state'] = current_checkbox['state'];
        }
        if(e.shiftKey && (current_checkbox.state == 'checked' || current_checkbox.state == 'unchecked')){
            _t.addClass('shift-key');
            if(shift_key_check.column !== null && shift_key_check.state == current_checkbox.state){
                var shift_index = shift_key_check.column.attr('_index'), parent = _t.parents('.agt-line'), table_id = parent.attr('_table_id'), start_index = 0, end_index = 0;
                if(shift_index > _index){
                    start_index = parseInt(_index);
                    end_index = parseInt(shift_index);
                }else{
                    end_index = parseInt(_index);
                    start_index = parseInt(shift_index);
                }
                var loop_column = parent.parent().children('#' + table_id + '-line-' + start_index);
                while(start_index <= end_index){
                    var loop_record = records[start_index]['checkbox'];
                    if(loop_record['state'] != 'disabled' && loop_record['state'] != 'locked'){
                        loop_record['state'] = current_checkbox.state;
                        if(loop_record.state == 'checked'){
                            loop_column.find('.agti-check-column').removeClass('agti-check-half').addClass('agti-checked');
                        }else{
                            loop_column.find('.agti-check-column').removeClass('agti-check-half agti-checked');
                        }
                    }
                    loop_column = loop_column.next();
                    start_index++;
                }
                shift_key_check.column.removeClass('shift-key');
            }
            shift_key_check.column = _t;
            shift_key_check.state = current_checkbox.state;
        }else{
            if(shift_key_check.column !== null){
                shift_key_check.column.removeClass('shift-key');
                shift_key_check.column = null;
                shift_key_check.state = '';
            }
        }
        var is_checked = false, is_unchecked = false, half = false;
        $.each(records, function(index, record){
            if(record['checkbox']['state'] == 'checked'){
                is_checked = true;
            }else if(record['checkbox']['state'] == 'unchecked'){
                is_unchecked = true;
            }
            if(is_checked && is_unchecked){
                half = true;
                return false;
            }
        });
        var re_head_check = _this.head.find('.agti-check-column:first');
        if(half){
            re_head_check.removeClass('agti-checked').addClass('agti-check-half');
        }else{
            re_head_check.removeClass('agti-check-half');
            current_checkbox['state'] == 'checked' ? re_head_check.addClass('agti-checked') : re_head_check.removeClass('agti-checked');
        }
        grid.def.checkbox.callback && grid.def.checkbox.callback.call(_t, _index, current_checkbox.state);
    });
    _this.head.off('click', '.agti-check-column').on('click', '.agti-check-column', function(e){
        var _t = $(this), _c = _t.hasClass('agti-checked'), records = grid.get.records();
        _t.removeClass('agti-check-half');
        _c ? _t.removeClass('agti-checked') : _t.addClass('agti-checked');
        if(records){
            $.each(records, function(index, record){
                var state = record['checkbox']['state'];
                if(state != 'disabled' && state != 'locked' && state != 'half'){
                    record['checkbox']['state'] = _c ? 'unchecked' : 'checked';
                }
            });
            _this.table.find('.agti-check-column').each(function(){
                var _i = $(this).attr('_index');
                if(records[_i] && records[_i]['checkbox']){
                    var state = records[_i]['checkbox']['state'];
                    if(state != 'disabled' && state != 'locked' && state != 'half'){
                        _c ? $(this).removeClass('agti-checked') : $(this).addClass('agti-checked');
                    }
                }
            });
        }
        if(shift_key_check.column !== null){
            shift_key_check.column.removeClass('shift-key');
            shift_key_check.column = null;
            shift_key_check.state = '';
        }
        grid.def.checkbox.callback && grid.def.checkbox.callback.call(_t, -1, _c ? 'unchecked' : 'checked');
    });
};
AppGridCheckbox.prototype.set = function(type, state){
    switch(type){
        case 'head':
            var head = this.head.find('.agti-check-column:first');
            switch(state){
                case 'half':
                    head.attr('class', 'agti-check-column agt-icon agti-check agti-check-half');
                    break;
                case 'checked':
                    head.attr('class', 'agti-check-column agt-icon agti-check agti-checked');
                    break;
                case 'unchecked':
                    head.attr('class', 'agti-check-column agt-icon agti-check');
                    break;
                case 'disabled':
                    head.attr('class', 'agti-check-column agt-icon agti-check agti-check-disabled');
                    break;
                case 'locked':
                    head.attr('class', 'agti-check-column agt-icon agti-check agti-check-locked');
                    break;
            }
            break;
    }
};
AppGridCheckbox.prototype.get = function(){
    var result = {index: [], records: {}}, grid = this.grid;
    $.each(grid.def.data.records, function(index, record){
        if(record['checkbox'].state == 'checked' || record['checkbox'].state == 'locked'){
            result.index.push(index);
            result.records[index] = record;
        }
    });
    return result;
};


var AppGridDragBase = function(setting){
    this.setting = {
        proxy: null,
        cursor:'move',
        handle: null,
        container: null,
        onMoveDrag: function(e){},
        onStartDrag: function(e){},
        onStopDrag: function(e){}
    };
    $.extend(true, this.setting, setting);
    this.init();
};
AppGridDragBase.prototype.init = function(){
    var _this = this;
    _this.setting.handle.unbind('.appdrag').bind('mousemove.appdrag', function(e){
        $(this).css('cursor', _this.setting.cursor);
    }).bind('mouseleave.appdrag', function(e){
        $(this).css('cursor', '');
    }).bind('mousedown.appdrag', function(e){
        $(this).css('cursor', '');
        var parent = _this.setting.handle.parent(), offset = parent.offset();
        var scrollTop = $(window).scrollTop();
        var container = _this.setting.container.offset();
        container.top -= scrollTop;
        offset.top -= scrollTop;
        _this.setting.left && (offset.left = _this.setting.left);
        var data = {
            startLeft: offset.left,
            startTop: offset.top,
            containerTop: container.top,
            left: offset.left,
            top: offset.top,
            startX: e.pageX,
            startY: e.pageY,
            startCX: e.clientX,
            startCY: e.clientY,
            offsetWidth: (e.pageX - offset.left),
            offsetHeight: (e.pageY - offset.top),
            height: parent.outerHeight(),
            parent: parent
        };
        _this.data = $.extend(e.data, data);
        container.height = _this.setting.container.outerHeight() - data.height;
        _this.container = {min: container.top, max: container.top + container.height, left: container.left, right: container.left + _this.setting.container.outerWidth()};
        $(document).bind('mousedown.appdrag', {target: _this}, _this.down);
        $(document).bind('mousemove.appdrag', {target: _this}, _this.move);
        $(document).bind('mouseup.appdrag', {target: _this}, _this.up);
    });
};
AppGridDragBase.prototype.down = function(e){
    var _this = e.data.target;
    _this.data.proxy = _this.setting.proxy.call(null, _this.data.parent);
    _this.data.proxy.css('position', 'fixed');
    _this.drag(e);
    _this.applyDrag(e);
    _this.setting.onStartDrag.call(null, _this.data);
    return false;
};
AppGridDragBase.prototype.applyDrag = function(e){
    var _this = e.data.target;
    _this.data.proxy.css({left:_this.data.left, top:_this.data.top});
    _this.data.clientX = e.clientX;
    _this.data.clientY = e.clientY;
    $('body').css('cursor', _this.setting.cursor);
};
AppGridDragBase.prototype.move = function(e){
    var _this = e.data.target;
    _this.drag(e);
    _this.applyDrag(e);
    _this.setting.onMoveDrag.call(null, _this.data);
    return false;
};
AppGridDragBase.prototype.up = function(e){
    var _this = e.data.target;
    _this.move(e);
    _this.data.proxy.remove();
    _this.setting.onStopDrag.call(null, _this.data);
    $(document).unbind('.appdrag');
    $('body').css('cursor', '');
    return false;
};
AppGridDragBase.prototype.drag = function(e){
    var _this = e.data.target;
    var opts = _this.setting;
    var proxy = _this.data.proxy;
    var dragData = _this.data;
    var left = dragData.startLeft + e.pageX - dragData.startX;
    var top = dragData.startTop + e.pageY - dragData.startY;
    if (proxy){
        if (opts.deltaX != null && opts.deltaX != undefined){
            left += e.data.offsetWidth + opts.deltaX;
        }
        if (opts.deltaY != null && opts.deltaY != undefined){
            top += e.data.offsetHeight + opts.deltaY;
        }
    }
    left += dragData.parent.scrollLeft();
    top += dragData.parent.scrollTop();
    if(top <= _this.container.min){
        top = _this.container.min;
    }
    if(top >= _this.container.max){
        top = _this.container.max;
    }
    if(opts.enableLeft){
        if(left <= _this.container.left){
            left = _this.container.left;
        }
        if(left >= _this.container.right){
            left = _this.container.right;
        }
        dragData.left = left;
    }
    dragData.top = top;
};


var AppGridDraggable = function(grid){
	var _this = this;
	_this.grid = grid;
	_this.status = false;
	grid.body_render.on('mouseenter', grid.def.drag.handle, function(){
		grid.def.drag.status && _this.status === false && _this.drag($(this));
	});
};
AppGridDraggable.prototype.drag = function(handle){
	var grid = this.grid, _this = this; _this.index = null;
	var config = {
		handle: handle,
	    left: grid.position.table.left,
	    container: grid.body_render,
	    proxy: function(source){
	    	_this.index = parseInt($(source).attr('_index'));
	    	var content = grid.head_render.clone().removeAttr('id'), move = $('<div class="agt-invent-move"></div>').append(content).appendTo(grid.body_render);	    	
	    	$.each(grid.render, function(id, render){
	    		var line = render['body_tbody'].find('#'+id+'-body-line-'+_this.index);
	    		var clone = line.clone();
	    		line.addClass('agt-drag-invent');	    		
	    		content.find('#'+id+'-head').find('.app-grid-head-tbody').append(clone);
	    		content.find('#'+id+'-head').find('.app-grid-head-thead').remove();
	    	});
	    	return move;
	    },
	    onStartDrag: function(data){
	    	_this.status = true;
	    },
		onStopDrag: function(data){
			_this.status = false;
			if(Math.abs(data.top - data.startTop) > data.height){	
				var move = data.top - data.containerTop;
				if(grid.scroll_obj[grid.def.id]){
					move += grid.scroll_obj[grid.def.id].scroll;
				}
				var next = _this.position(move);
				_this.move(next);
				grid.def.drag.callback && grid.def.drag.callback.call(grid, _this.index, next);
			}
			grid.body_render.find('.agt-drag-invent').removeClass('agt-drag-invent');
		}
	};
	new AppGridDragBase(config);	
};
AppGridDraggable.prototype.move = function(next){
	var grid = this.grid, _this = this;
	if(next > _this.index){
		$.each(grid.render, function(id, render){
			var start = _this.index + 1, end = next, num = next - 1;
			var index = render['body_tbody'].find('#'+id+'-body-line-'+_this.index);
			var line = render['body_tbody'].find('#'+id+'-body-line-'+start);
			while(start < end){
				var temp = start++ - 1;
				line.attr({id: id+'-body-line-' + temp, _index: temp});
				line = line.next();
			}
			if(line.length){				
				line.before(index.attr({id: id+'-body-line-' + num, _index: num}));
			}else{
				render['body_tbody'].append(index.attr({id: id+'-body-line-' + num, _index: num}));
			}
		});
	}else{		
		$.each(grid.render, function(id, render){
			var start = next, end = _this.index;
			var line = render['body_tbody'].find('#'+id+'-body-line-'+start);
			var targ = render['body_tbody'].find('#'+id+'-body-line-'+next);
			while(start++ < end){
				line.attr({id: id+'-body-line-' + start, _index: start});
				line = line.next();
			}
			targ.before(line.attr({id: id+'-body-line-'+next, _index: next}));
		});
	}
};
AppGridDraggable.prototype.position = function(top){
    var _this = this;
    //首行可以精确到0, 这里使用ceil
    var next = Math.ceil(top / _this.grid.height.tr.outerHeight);
    var grid_records = _this.grid.get.records(), records = [];
    if(next > 0){
        if(_this.index == 0){
            records = records.concat(grid_records.slice(1, next));
            records = records.concat(grid_records.slice(0, 1));
            records = records.concat(grid_records.slice(next));
        }else{
            if(_this.index > next){
                records = records.concat(grid_records.slice(0, next));
                records = records.concat(grid_records.slice(_this.index, _this.index + 1));
                records = records.concat(grid_records.slice(next, _this.index));
                records = records.concat(grid_records.slice(_this.index + 1));
            }else{
                records = records.concat(grid_records.slice(0, _this.index));
                records = records.concat(grid_records.slice(_this.index + 1, next));
                records = records.concat(grid_records.slice(_this.index, _this.index + 1));
                records = records.concat(grid_records.slice(next));
            }
        }
        _this.grid.def.data.records = records;
        _this.grid.reCalculatePaginator();
        return next;
    }else{
        records = records.concat(grid_records.splice(_this.index, 1));
        records = records.concat(grid_records);
        _this.grid.def.data.records = records;
        _this.grid.reCalculatePaginator();
        return 0;
    }
};


var AppGridExcel = function(){	
	this.lines = [];
	this.columns = [];
	this.options = [];
	this.styles = [
	   '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center" ss:Horizontal="Left" /><Font ss:FontName="微软雅黑" x:CharSet="134" ss:Size="10"/></Style>',
	   '<Style ss:ID="Title"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="微软雅黑" x:CharSet="134" ss:Size="14" ss:Bold="1"/></Style>',
	   '<Style ss:ID="sTitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sLeft"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sRight"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumLeft"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumRight"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumLeftFirst"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumCenterFirst"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumRightFirst"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumLeftLast"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumCenterLast"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>',
	   '<Style ss:ID="sumRightLast"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:FontName="微软雅黑" ss:Bold="1" x:CharSet="134"/></Style>'
	];
};
AppGridExcel.prototype.setWorksheetTitle = function(title){
    this.worksheet_title = title;
};
AppGridExcel.prototype.setColumns = function(columns){
    var _this = this;
    $.each(columns, function(index, width){
        _this.columns.push('<Column ss:AutoFitWidth="0" ss:Width="' + width + '"> </Column>');
    });
};
AppGridExcel.prototype.addFormatedRow = function(format, values, height){
    var cells = '';
    $.each(format, function(index, fmt){
        cells += '<Cell ';
        $.each(fmt, function(key, value){
            cells += ' ss:' + key + '="' + value + '"';
        });
        cells += '>';
        var temp = values[index] === undefined ? '' : values[index];
        if($.isNumeric(temp)){
            cells += '<Data ss:Type="Number">' + temp + '</Data></Cell>\n';
        }else{
            cells += '<Data ss:Type="String">' + temp + '</Data></Cell>\n';
        }
    });
    if(height){
        this.lines.push('<Row ss:AutoFitHeight="0" ss:Height="'+height+'">\n' + cells + '</Row>\n');
    }else{
        this.lines.push('<Row>\n' + cells + '</Row>\n');
    }
};
AppGridExcel.prototype.addFormatedRows = function(format, array, height){
    var _this = this;
    $.each(array, function(index, values){
        _this.addFormatedRow(format[index], values, height);
    });
};
AppGridExcel.prototype.addRow = function(values, style_id, height, start_index){
    var cells = '';
    if(start_index != 1){
        cells += '<Cell ss:Index="'+start_index+'" ';
        if(style_id){
            cells += 'ss:StyleID="'+style_id+'">';
        }else{
            cells += '>';
        }
        var first = values.shift();
        if($.isNumeric(first)){
            cells += '<Data ss:Type="Number">' + first + '</Data></Cell>\n';
        }else{
            cells += '<Data ss:Type="String">' + first + '</Data></Cell>\n';
        }
    }
    $.each(values, function(index, value){
        if(style_id){
            cells += '<Cell ss:StyleID="'+style_id+'">';
        }else{
			cells += '<Cell>';
        }
        if($.isNumeric(value)){
            cells += '<Data ss:Type="Number">' + value + '</Data></Cell>\n';
        }else{
            cells += '<Data ss:Type="String">' + value + '</Data></Cell>\n';
        }
    });
    if(height){
        this.lines.push('<Row ss:AutoFitHeight="0" ss:Height="'+height+'">\n' + cells + '</Row>\n');
    }else{
        this.lines.push('<Row>\n' + cells + '</Row>\n');
    }
};
AppGridExcel.prototype.outPut = function(){
    var content = '<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">';
    content += '\n<Styles>';
    content += '\n' + this.styles.join('\n');
    content += '\n</Styles>';
    content += '\n<Worksheet ss:Name="' + this.worksheet_title + '">';
    content += '\n<Table>';
    content += '\n' + this.columns.join("\n");
    content += '\n' + this.lines.join("\n");
    content += '\n</Table>';
    content += '\n<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">';
    content += '\n' + this.options.join("\n");;
    content += '\n</WorksheetOptions>';
    content += '\n</Worksheet>';
    content += '\n</Workbook>';
    return content;
};
AppGridExcel.prototype.createGridExcel = function(grid, extend){
	this.start_index = 2;
	this.grid_records = extend && extend.records ? extend.records : grid.get.records();
	this.index_to_field = extend && extend.index_to_field ? extend.index_to_field : grid.index_to_field;
	this.grid_summary = extend && extend.summary? extend.summary : grid.get.summary();
	this.createGridExcelSheet(grid.def.toolbar.exportexcel.excelsheetname);
	this.createGridExcelColumns(grid);
	if(typeof grid.def.toolbar.exportexcel.exceltitlename == 'function'){
		this.createGridExcelTitle(grid.def.toolbar.exportexcel.exceltitlename(grid));
	}else{		
		this.createGridExcelTitle(grid.def.toolbar.exportexcel.exceltitlename);
	}
	this.createGridExcelDate();
	if(extend && extend.field_to_items){
		this.createGridFieldHead(extend.field_to_items);
	}else{
		this.createGridExcelHead(grid);
	}
	this.createGridExcelBody(grid);
	this.createGridExcelFoot(grid);
	return this.outPut();
};
AppGridExcel.prototype.createGridExcelSheet = function(name){
    this.setWorksheetTitle(name ? name : 'Sheet1');
};
AppGridExcel.prototype.createGridExcelTitle = function(name){
    this.addFormatedRow([{'Index': this.start_index, 'MergeAcross': this.columns_length - this.start_index, 'StyleID': 'Title'}], [name ? name : ''], 30);
};
AppGridExcel.prototype.createGridExcelDate = function(){
    var date = '导出时间：';
    var today = new Date();
    var year = today.getFullYear();
    var month =  today.getMonth() + 1;
    var day = today.getDate();
    var hour = today.getHours();
    var min = today.getMinutes();
    var sec = today.getSeconds();
    date += year + '-' + (month < 10 ? ('0' + month) : month) + '-' + (day < 10 ? ('0' + day) : day) + ' ';
    date += (hour < 10 ? ('0' + hour) : hour) + ':';
    date += (min < 10 ? ('0' + min) : min) + ':';
    date += (sec < 10 ? ('0' + sec) : sec);
    this.addFormatedRow([{'Index': this.start_index, 'MergeAcross': this.columns_length - this.start_index, 'StyleID': 'sLeft'}], [date], 20);
};
AppGridExcel.prototype.createGridExcelColumns = function(grid){
    var columns = [20];
    $.each(this.index_to_field, function(index, field){
        var item = grid.field_to_items[field];
        columns.push(item.width ? item.width : grid.def.itemwidth);
    });
    this.columns_length = columns.length;
    this.setColumns(columns);
};
AppGridExcel.prototype.createGridFieldHead = function(field_to_items){
    var head_format = {}, head_record = {}, cross_index = this.start_index;
    $.each(this.index_to_field, function(index, field){
        var item = field_to_items[field];
        head_format[field] = {'StyleID': 'sTitle', 'Index': cross_index++};
        head_record[field] = item.title.filterHtml();
    });
    this.addFormatedRows([head_format], [head_record], 20);
};
AppGridExcel.prototype.createGridExcelHead = function(grid){
    var max_level = grid.max_column_level.value, head_format = {}, head_record = {}, cross_index = this.start_index;
    var cross_holder = {};
    $.each(grid.columns, function(index, column){
        $.each(column.items, function(level, item){
            if(cross_holder[level] === undefined){
                cross_holder[level] = [];
            }
            $.each(item, function(key, value){
                if(head_format[level - 1] === undefined){
                    head_format[level - 1] = {};
                    head_record[level - 1] = {};
                }
                if(cross_holder[level - 1]){
                    cross_index = cross_holder[level - 1].shift();
                }
                if(value.mapping){
                    var field = value.mapping['0'];
                    if(field != 'checkbox'){
                        head_format[level - 1][field] = {'StyleID': 'sTitle', 'Index': cross_index};
                        head_record[level - 1][field] = value.title.filterHtml();
                        if(max_level - level > 0){
                            head_format[level - 1][field]['MergeDown'] = max_level - level;
                        }
                        cross_index++;
                    }
                }else{
                    head_record[level - 1][value.id] = value.title.filterHtml();
                    head_format[level - 1][value.id] = {'StyleID': 'sTitle', 'MergeAcross': value.length - 1};
                    head_format[level - 1][value.id]['Index'] = cross_index;
                    for(var i = 0; i < value.length; i++){
                        cross_holder[level].push(cross_index++);
                        if(cross_holder[level - 1] && i > 0){
                            cross_holder[level - 1].shift();
                        }
                    }
                }
            });
        });
    });
    this.addFormatedRows(head_format, head_record, 20);
};
AppGridExcel.prototype.createGridExcelBody = function(grid){
	var _this = this, format = {}, rows = {};
	var colspan = grid.def.toolbar.exportexcel.colspan, rowspan = grid.def.toolbar.exportexcel.rowspan;
	var rowspan_index = {};
	var colspan_field = {};
	$.each(_this.grid_records, function(index, record){
		rows[index] = {};
		format[index] = {};
		$.each(_this.index_to_field, function(loop, field){
			var item = record[field], items = grid.field_to_items[field];
			format[index][field] = {'StyleID': 'sCenter'};
			format[index][field]['Index'] = loop + _this.start_index;
			if(item && item.colspan && colspan){
				if(item.colspan === 1){
					delete colspan_field[index];
				}else{
					if(item.colspan > 1){
						colspan_field[index] = field;
						format[index][field]['MergeAcross'] = 0;
					}else{
						format[index][colspan_field[index]]['MergeAcross']++;
						delete format[index][field];
						return true;
					}
				}
			}
			if(item && item.rowspan && rowspan){
				if(item.rowspan === 1){
					delete rowspan_index[field];
				}else{					
					if(item.rowspan > 1){
						rowspan_index[field] = index;
						format[rowspan_index[field]][field]['MergeDown'] = 0;
					}else{
						format[rowspan_index[field]][field]['MergeDown']++;
						delete format[index][field];
						return true;
					}
				}
			}
			if(items.style && items.style.td && items.style.td['text-align']){
				switch(items.style.td['text-align']){
					case 'left':
						format[index][field]['StyleID'] = 'sLeft';
						break;
					case 'right':
						format[index][field]['StyleID'] = 'sRight';
						break;
				}
			}
			var text = item ? item.text : '';
			if(items.renderer && typeof items.renderer == 'function'){
				text = grid.render[items['table_id']]['body'].getColumnHtml(items, record, index);
			}
			if(text === '' || text === null || text === undefined){
				rows[index][field] = '-';
			}else{					
				rows[index][field] = (typeof text == 'string' ? text.filterHtml() : text); 
			}
		});
	});
	this.addFormatedRows(format, rows, 20);
};
AppGridExcel.prototype.createGridExcelFoot = function(grid){
	var _this = this, format = {}, rows = {}, last_field = this.index_to_field.length-1;
	var colspan = grid.def.toolbar.exportexcel.colspan, rowspan = grid.def.toolbar.exportexcel.rowspan;
	var rowspan_index = {};
	var colspan_field = {};
	$.each(_this.grid_summary, function(index, record){
		format[index] = {};
		rows[index] = {};
		$.each(_this.index_to_field, function(loop, field){
			var item = record[field], items = grid.field_to_items[field];
			format[index][field] = {'StyleID': 'sumCenter'};
			format[index][field]['Index'] = loop + _this.start_index;
			if(item && item.colspan && colspan){
				if(item.colspan === 1){
					delete colspan_field[index];
				}else{
					if(item.colspan > 1){
						colspan_field[index] = field;
						format[index][field]['MergeAcross'] = 0;
					}else{
						format[index][colspan_field[index]]['MergeAcross']++;
						delete format[index][field];
						return true;
					}
				}
			}
			if(item && item.rowspan && rowspan){
				if(item.rowspan === 1){
					delete rowspan_index[field];
				}else{					
					if(item.rowspan > 1){
						rowspan_index[field] = index;
						format[rowspan_index[field]][field]['MergeDown'] = 0;
					}else{
						format[rowspan_index[field]][field]['MergeDown']++;
						delete format[index][field];
						return true;
					}					

				}
			}
			if(item && items.style && items.style.td && items.style.td['text-align']){
				switch(items.style.td['text-align']){
					case 'left':
						format[index][field]['StyleID'] = 'sumLeft';
						break;
					case 'right':
						format[index][field]['StyleID'] = 'sumRight';
						break;
				}
			}
			if (loop === 0) {
				format[index][field]['StyleID'] += 'First';
			}
			else if (loop === last_field){
				format[index][field]['StyleID'] += 'Last';
			}
			var text = item && item.text ? item.text : '';
			if(items.renderer && typeof items.renderer == 'function'){
				text = grid.render[items['table_id']]['body'].getColumnHtml(items, record, index);
			}
			rows[index][field] = (typeof text == 'string' ? text.filterHtml() : text);
		});
	});
	this.addFormatedRows(format, rows, 20);
};
/**
 * 保存文件模块
 * @param blob
 * @param filename
 */
APP_GRID_GLOBAL_OBJECT.save_link = window.document.createElementNS("http://www.w3.org/1999/xhtml", "a");
APP_GRID_GLOBAL_OBJECT.support_download_attr = "download" in APP_GRID_GLOBAL_OBJECT.save_link;
APP_GRID_GLOBAL_OBJECT.is_safari = /Version\/[\d\.]+.*Safari/.test(navigator.userAgent);
APP_GRID_GLOBAL_OBJECT.file_system = window.requestFileSystem || window.webkitRequestFileSystem || window.mozRequestFileSystem;
AppGridFileSave = function(string, filename, type, unableexport, grid){
	this.filename = filename || "download";
	this.type = type ? type : "application/vnd.ms-excel";
	if(APP_GRID_GLOBAL_OBJECT.is_safari && unableexport){
		//safari各版本支持不一致，尽量使用自定义处理方式
		unableexport(string, filename);
		return true;
	}

    if(grid && grid.def.toolbar.exportexcel.url)
    {
        var grid_container = $('#'+grid.def.id);
        grid_container.find('.export_excel_data').val(string);
        grid_container.find('.export_excel_filename').val(this.filename);
        grid_container.find('.export_excel_form').submit();
    }
	else if (navigator && navigator.msSaveOrOpenBlob) {
		navigator.msSaveOrOpenBlob(this.getBlob(string), this.filename);
	}else if("ActiveXObject" in window){
        var saveTxtWindow = window.frames.saveTxtWindow;
        if (!saveTxtWindow) {
            saveTxtWindow = document.createElement('iframe');
            saveTxtWindow.id = 'saveTxtWindow';
            saveTxtWindow.style.display = 'none';
            document.body.insertBefore(saveTxtWindow, null);
            saveTxtWindow = window.frames.saveTxtWindow;
            if (!saveTxtWindow) {
                saveTxtWindow = window.open('', '_temp', 'width=100,height=100');
                if (!saveTxtWindow) {
                    return false;
                }
            }
        }
        var doc = saveTxtWindow.document;
        doc.open(this.type, 'replace');
        doc.charset = 'utf-8';
        doc.write(string);
        doc.close();
        doc.execCommand('SaveAs', null, this.filename);
        saveTxtWindow.close();
    }else{
        this.blob = this.getBlob(string);
        this.readyState = this.INIT = 0;
        this.WRITING = 1;
        this.DONE = 2;
        this.init();
    }
};
AppGridFileSave.prototype.getBlob = function(string){
    return new Blob([string], {type: this.type + ";charset=utf-8"});
};
AppGridFileSave.prototype.init = function(){
    var _this = this;
    if(APP_GRID_GLOBAL_OBJECT.support_download_attr === true){
        _this.object_url = _this.getUrl().createObjectURL(_this.blob);
        APP_GRID_GLOBAL_OBJECT.callback(function(){
            APP_GRID_GLOBAL_OBJECT.save_link.href = _this.object_url;
            APP_GRID_GLOBAL_OBJECT.save_link.download = _this.filename;
            APP_GRID_GLOBAL_OBJECT.save_link.dispatchEvent(new MouseEvent("click"));
            _this.dispatchAll();
            _this.revoke(_this.object_url);
            _this.readyState = _this.DONE;
        });
    }else{
        if(window.webkitRequestFileSystem && _this.filename != 'download'){
            _this.filename += '.download';
        }
        if(!APP_GRID_GLOBAL_OBJECT.file_system){
            _this.error();
        }else{
            APP_GRID_GLOBAL_OBJECT.file_system(window.TEMPORARY, _this.blob.size, _this.abortable(function(fs){
                fs.root.getDirectory('saved', {create: true, exclusive: false}, _this.abortable(function(dir){
                    var save = function(){
                        dir.getFile(name, {create: true, exclusive: false}, _this.abortable(function(file){
                            file.createWriter(_this.abortable(function(writer){
                                writer.onwriteend = function(event){
                                    window.location.href = file.toURL();
                                    _this.readyState = _this.DONE;
                                    _this.dispatch("writeend", event);
                                };
                                writer.onerror = function(){
                                    var error = writer.error;
                                    if(error.code != error.ABORT_ERR){
                                        _this.error();
                                    }
                                };
                                $.each(["writestart", "progress", "write", "abort"], function(index, event){
                                    writer["on" + event] = _this["on" + event];
                                });
                                writer.write(blob);
                                _this.abort = function(){
                                    writer.abort();
                                    _this.readyState = _this.DONE;
                                };
                                _this.readyState = _this.WRITING;
                            }), _this.error);
                        }), _this.error);
                    };
                    dir.getFile(name, {create: false}, _this.abortable(function(file){
                        file.remove();
                        save();
                    }), _this.abortable(function(ex){
                        if(ex.code == ex.NOT_FOUND_ERR){
                            save();
                        }else{
                            _this.error();
                        }
                    }));
                }), _this.error);
            }), _this.error);
        }
    }
};
AppGridFileSave.prototype.abort = function(){
    this.readyState = this.DONE;
    this.dispatch("abort");
};
AppGridFileSave.prototype.getUrl = function(){
    return window.URL || window.wekitURL || window;
};
AppGridFileSave.prototype.dispatch = function(types, event){
    types = [].concat(types);
    var i = types.length, _this = this;
    while(i--){
        var listener = _this["on" + types[i]];
        if(typeof listener == 'function'){
            listener.call(_this, event || _this);
        }
    }
};
AppGridFileSave.prototype.dispatchAll = function(){
    this.dispatch(["writestart", "progress", "write", "writeend"]);
};
AppGridFileSave.prototype.revoke = function(file){
    var _this = this;
    var action = function(){
        if(typeof file == 'string'){
            _this.getUrl().revokeObjectURL(file);
        }else{
            file.remove();
        }
    };
    APP_GRID_GLOBAL_OBJECT.callback(action, 100);
};
AppGridFileSave.prototype.error = function(){
    var _this = this;
    if(APP_GRID_GLOBAL_OBJECT.is_safari && typeof FileReader !== undefined){
        var reader = new FileReader();
        reader.onloadend = function(){
            var data = reader.result;
            window.location.href = "data:attachment/file" + data.slice(data.search(/[,;]/));
            _this.readyState = _this.DONE;
            _this.dispatchAll();
        };
        reader.readAsDataURL(_this.blob);
        _this.readyState = _this.INIT;
    }else{
        _this.object_url = _this.getUrl().createObjectURL(_this.blob);
        window.location.href = _this.object_url;
        _this.readyState = _this.DONE;
        _this.dispatchAll();
        _this.revoke(_this.object_url);
    };
};
AppGridFileSave.prototype.abortable = function(fun){
    var _this = this;
    return function(){
        if(_this.readyState != _this.DONE){
            return fun.apply(this, arguments);
        }
    };
};

var AppGridItemOperate = function(grid){
    this.setting = {
        filter: {
            enable: true,
            greater: {
                enable: false
            },
            less: {
                enable: false
            },
            equal: {
                enable: false
            },
            unequal: {
                enable: false
            },
            search: {
                enable: true
            },
            select: {
                enable: false
            }
        },
        split: {
            enable: false
        },
        locked: {
            enable: false
        },
    };
    this.grid = grid;
    this.items = {};
    this.holder = {};
    this.filter_items = {};
    this.filter_items_select = {};
    this.reverse = false;
    this.init();
};
AppGridItemOperate.prototype.init = function(){
    var _this = this;
    _this.operate_place = $('<div class="agt-operate-place">').append(_this.list_place = $('<ul class="agt-operate-line-place"/>'), _this.filter_place = $('<div class="agt-operate-filter-place">'));
    _this.operate_place.appendTo(_this.grid.head_render);
    _this.grid.head_render.on('click', '.agt-th-operate', function(e){
        var target = $(this), target_offset = target.offset(), head_offset = _this.grid.head_render.offset();
        _this.current_field = target.attr('_field');
        var limit_left = head_offset.left + _this.grid.width.grid;
        if(target_offset.left + 360 > limit_left){
            _this.reverse = true;
            _this.list_place.addClass('reverse');
            _this.position = {top: target_offset.top - head_offset.top + 18, left: target_offset.left - head_offset.left - 105 + 18};
        }else{
            _this.reverse = false;
            _this.list_place.removeClass('reverse');
            _this.position = {top: target_offset.top - head_offset.top + 18, left: target_offset.left - head_offset.left};
        }
        _this.filter_place.hide();
        _this.create();
        APP_GRID_GLOBAL_OBJECT.clear(e);
    });
    _this.operate_place.click(function(e){
        APP_GRID_GLOBAL_OBJECT.clear(e);
    });
    _this.operate_place.on('click', '.agt-operate-line', function(e){
        var target = $(this), value = target.attr('_value');
        if(target.hasClass('disabled')){
            return false;
        }
        switch(value){
            case '1':
                _this.changeFrozen(true);
                break;
            case '2':
                _this.changeFrozen(false);
                break;
            case '3':
                break;
            case '4':
                delete _this.holder[_this.current_field];
                _this.doFilterAction();
                break;
            case '6':
                break;
        }
    }).on('mouseover', '.agt-operate-line', function(e){
        var target = $(this), value = target.attr('_value');
        if(value == '3'){
            if(_this.reverse){
                _this.filter_place.css({left: -251, top: target.position().top - 1}).show();
            }else{
                _this.filter_place.css({left: _this.list_place.outerWidth(), top: target.position().top - 1}).show();
            }
            target.addClass('selected');
            _this.filter();
        }else{
            target.siblings().removeClass('selected');
            _this.filter_place.hide();
        }
    });
    $('body').click(function(){
        _this.close();
    });
};
AppGridItemOperate.prototype.create = function(){
    var _this = this, content = [], grid = _this.grid, items = _this.getItems();
    $.each(items, function(index, item){
        switch(item.value){
            case '1':
                if(grid.field_to_items[_this.current_field]['locked']){
                    return true;
                }
                item.status = grid.field_to_items[_this.current_field]['frozen'] ? 'disabled' : 'enabled';
                break;
            case '2':
                if(grid.field_to_items[_this.current_field]['locked']){
                    return true;
                }
                item.status = grid.field_to_items[_this.current_field]['frozen'] ? 'enabled' : 'disabled';
                break;
            case '4':
                item.status = _this.holder[_this.current_field] ? 'enabled' : 'disabled';
                break;
        }
        content.push('<li class="agt-operate-line '+(item.status == 'disabled' ? 'disabled' : '')+'" _value="'+item.value+'">');
        if(_this.reverse){
            item.child && content.push('<span class="agt-icon agti-next-10"></span>');
            content.push('<span class="agt-operate-line-text">');
            content.push(item.text);
            content.push('</span>');
            item.icon && content.push(item.icon);
        }else{
            item.icon && content.push(item.icon);
            content.push('<span class="agt-operate-line-text">');
            content.push(item.text);
            content.push('</span>');
            item.child && content.push('<span class="agt-icon agti-next-10"></span>');
        }
        content.push('</li>');
    });
    _this.list_place.empty().append(content.join(''));
    _this.operate_place.show().css({left: _this.position.left, top: _this.position.top});
};
AppGridItemOperate.prototype.getItems = function(){
    var _this = this, grid = _this.grid, operate = $.extend(true, {}, _this.setting, grid.field_to_items[_this.current_field]['operate']);
    if(_this.items[_this.current_field] === undefined){
        _this.items[_this.current_field] = [];
        operate.locked.enable && grid.def.columns.length > 1 && _this.items[_this.current_field].push({
            value: '1',
            text: '设为固定',
            icon: '<span class="agt-icon agti-lock"></span>',
            status: 'enabled'
        }, {
            value: '2',
            text: '解除固定',
            icon: '<span class="agt-icon agti-unlock"></span>',
            status: 'enabled'
        });
        operate.split.enable && _this.items[_this.current_field].push({
            value: '6',
            text: '拆分数据',
            icon: '<span class="agt-icon agti-split"></span>',
            status: 'enabled'
        });
        if(operate.filter.enable){
            _this.items[_this.current_field].push({
                value: '3',
                text: '筛选数据',
                icon: '<span class="agt-icon agti-filter"></span>',
                status: 'enabled',
                child: true
            }, {
                value: '4',
                text: '清除筛选',
                icon: '<span class="agt-icon agti-unfilter"></span>',
                status: 'enabled'
            });
            _this.filter_items[_this.current_field] = [];
            operate.filter.select.enable && _this.filter_items[_this.current_field].push({value: '6', text: '选择'});
            operate.filter.search.enable && _this.filter_items[_this.current_field].push({value: '1', text: '查找'});
            operate.filter.greater.enable && _this.filter_items[_this.current_field].push({value: '2', text: '大于'});
            operate.filter.equal.enable && _this.filter_items[_this.current_field].push({value: '3', text: '等于'});
            operate.filter.less.enable && _this.filter_items[_this.current_field].push({value: '4', text: '小于'});
            operate.filter.unequal.enable && _this.filter_items[_this.current_field].push({value: '5', text: '不等'});
        }
    }
    //这个计算暂时放外面，因为records可能会发生变化，这里需要实时计算，后续再调整
    if(operate.filter.select.enable){
        _this.filter_items_select[_this.current_field] = [];
        var records = grid.init_records, skip = {};
        $.each(records, function(index, record){
            var item = record[_this.current_field];
            if(item && skip[item['value']] === undefined){
                _this.filter_items_select[_this.current_field].push({value: item['value'], text: item['text']});
                skip[item['value']] = true;
            }
        });
    }
    return _this.items[_this.current_field];
};
/**
 * 改变字段位置状态
 * @param frozen
 */
AppGridItemOperate.prototype.changeFrozen = function(frozen){
    var grid = this.grid;
    if(frozen === true){
        this.setFrozen();
    }else{
        this.cancelFrozen();
    }
    grid.begin();
    grid.refreshOutPut();
    grid.renderHead();
    grid.renderBody();
    grid.renderFoot();
    grid.def.itemsoperate.callback && grid.def.itemsoperate.callback({field: this.current_field, action: 'change-frozen'});
    this.close();
};
/**
 * 设为固定
 */
AppGridItemOperate.prototype.setFrozen = function(){
    var _this = this, grid = _this.grid;
    var init_item = grid.init_items[_this.current_field];
    var ready_to_move = _this.getMoveItem();
    if(init_item['frozen'] === true){
        _this.resetFrozen(ready_to_move);
    }else{
        $.each(grid.def.columns, function(key, column){
            if(column.frozen === true){
                column.items.push(ready_to_move['0']);
                return false;
            }
        });
    }
};
/**
 * 取消固定
 */
AppGridItemOperate.prototype.cancelFrozen = function(){
    var _this = this, grid = _this.grid;
    var ready_to_move = _this.getMoveItem();
    var init_item = grid.init_items[_this.current_field];
    if(init_item['frozen'] === true){
        $.each(grid.def.columns, function(key, column){
            if(column.frozen !== true){
                column.items.unshift(ready_to_move['0']);
                return false;
            }
        });
    }else{
        _this.resetFrozen(ready_to_move);
    }
};
/**
 * 提取移动字段
 * @returns
 */
AppGridItemOperate.prototype.getMoveItem = function(){
    var _this = this, grid = _this.grid;
    var item = grid.field_to_items[_this.current_field];
    var path_split = item['path'].split('-');
    var first_path = path_split.shift();
    var last_path = path_split.pop();
    var path = null;
    var father_item = grid.def.columns[first_path]['items'];
    while(path = path_split.shift()){
        father_item = father_item[path]['items'];
    }
    return father_item.splice(last_path, 1);
};
/**
 * 重置加初始位置
 * @param ready_to_move
 */
AppGridItemOperate.prototype.resetFrozen = function(ready_to_move){
    var _this = this, grid = _this.grid, init_item = grid.init_items[_this.current_field];
    var insert_position = 0;
    var init_path = init_item['path'].split('-');
    var first_init_path = init_path.shift();
    init_path.pop();
    var father_init_item = grid.init_columns[first_init_path]['items'];
    var father_curr_item = grid.def.columns[first_init_path]['items'];
    var path = 0;
    while(path = init_path.shift()){
        var father_init = father_init_item[path], father_curr = father_curr_item[path];
        father_init_item = father_init['items'];
        if(father_curr && father_curr.id == father_init.id){
            father_curr_item = father_curr['items'];
        }else{
            $.each(father_curr_item, function(index, item){
                if(item.id == father_init.id){
                    father_curr_item = item['items'];
                    return false;
                }
            });
        }
    }
    if(father_curr_item.length){
        var curr_item_map = {};
        $.each(father_curr_item, function(index, item){
            if(item.id){
                curr_item_map[item.id] = true;
            }else{
                curr_item_map[item['mapping']['0']] = true;
            }
        });
        $.each(father_init_item, function(index, item){
            if(item['mapping']){
                var mapping = item['mapping']['0'];
                if(mapping == _this.current_field){
                    return false;
                }
                if(curr_item_map[mapping]){
                    insert_position++;
                }
            }else{
                if(curr_item_map[item['name']]){
                    insert_position++;
                }
            }
        });
    }
    father_curr_item.splice(insert_position, 0, ready_to_move['0']);
};
AppGridItemOperate.prototype.filter = function(){
    var content = [], _this = this, grid = _this.grid;
    content.push('<div class="agt-operate-filter-line" id="'+grid.def.id+'-app-grid-oper-filter-one-place"><div id="'+grid.def.id+'-app-grid-oper-filter-one" class="agt-inline-block"></div><div class="agt-inline-block agt-operate-filter-content"><input type="text" value="" class="agt-input"></div></div>');
    content.push('<div class="agt-operate-filter-line" id="'+grid.def.id+'-app-grid-oper-filter-two-place"><div id="'+grid.def.id+'-app-grid-oper-filter-two"></div></div>');
    content.push('<div class="agt-operate-filter-line" id="'+grid.def.id+'-app-grid-oper-filter-thr-place"><div id="'+grid.def.id+'-app-grid-oper-filter-thr" class="agt-inline-block"></div><div class="agt-inline-block agt-operate-filter-content"><input type="text" value="" class="agt-input"></div></div>');
    content.push('<div class="agt-operate-filter-line"><span class="agt-dialog-confirm">确认</span><span class="agt-dialog-cancel">取消</span></div>');
    _this.filter_place.empty().append(content.join(''));
    var filter_select = null, selected = _this.filter_items[_this.current_field]['0']['value'];
    var callback = function(value, type){
        var other = type == 'one' ? 'thr' : 'one';
        if(value == '6'){
            $('#'+grid.def.id+'-app-grid-oper-filter-'+type).next().empty().append('<span id="'+grid.def.id+'-app-grid-oper-filter-select"></span>');
            filter_select = new AppGridUtilityS({
                id: '#'+grid.def.id+'-app-grid-oper-filter-select',
                width: 140,
                items: _this.filter_items_select[_this.current_field],
                value: _this.filter_items_select[_this.current_field]['0'] ? _this.filter_items_select[_this.current_field]['0']['value'] : ''
            });
            $('#'+grid.def.id+'-app-grid-oper-filter-two-place').hide();
            $('#'+grid.def.id+'-app-grid-oper-filter-'+other+'-place').hide();
        }else{
            $('#'+grid.def.id+'-app-grid-oper-filter-'+type).next().empty().append('<input type="text" value="" class="agt-input">');
            filter_select = null;
            if(selected == '6' && _this.filter_items[_this.current_field].length > 1){
                $('#'+grid.def.id+'-app-grid-oper-filter-two-place').show();
                $('#'+grid.def.id+'-app-grid-oper-filter-'+other+'-place').show();
                if(type == 'one'){
                    thr_select.set(_this.filter_items[_this.current_field]['1']['value']);
                }else{
                    one_select.set(_this.filter_items[_this.current_field]['1']['value']);
                }
            }
        }
    };
    var one_select = new AppGridUtilityS({
        id: '#'+grid.def.id+'-app-grid-oper-filter-one',
        items: _this.filter_items[_this.current_field],
        value: selected,
        width: 60,
        callback: function(item){
            callback(item.value, 'one');
        }
    });
    var two_select = new AppGridUtilityS({
        id: '#'+grid.def.id+'-app-grid-oper-filter-two',
        items: [{value: '1', text: '且'}, {value: '2', text: '或'}],
        value: '1',
        width: 60
    });
    var thr_select = new AppGridUtilityS({
        id: '#'+grid.def.id+'-app-grid-oper-filter-thr',
        items: _this.filter_items[_this.current_field],
        value: selected,
        width: 60,
        callback: function(item){
            callback(item.value, 'thr');
        }
    });
    if(selected == '6'){
        callback('6', 'one');
    }
    _this.filter_place.find('.agt-dialog-cancel').click(function(){
        _this.close();
    }).end().find('.agt-dialog-confirm').click(function(){
        var combine = two_select.get().value, values = [];
        if(filter_select !== null){
            values.push({type: '6', value: filter_select.get().value});
        }else{
            _this.filter_place.find('input').each(function(index){
                var value = {value: $(this).val().trim()};
                if(value.value != ''){
                    if(index == '0'){
                        value.type = one_select.get().value;
                    }else{
                        value.type = thr_select.get().value;
                    }
                    values.push(value);
                }
            });
        }
        _this.holder[_this.current_field] = {values: values, combine: combine};
        _this.doFilterAction();
    });
};
AppGridItemOperate.prototype.doFilterAction = function(){
    var _this = this, grid = _this.grid, records = grid.init_records, result = [];
    grid.def.drag.status = true;
    $.each(records, function(index, record){
        result.push(record);
        $.each(_this.holder, function(field, rules){
            if(record[field]){
                var status = rules.combine == '1' ? true : false;
                $.each(rules.values, function(key, value){
                    if(rules.combine == '1'){
                        status &= _this.doFilter(value, record[field]['value']);
                    }else{
                        status |= _this.doFilter(value, record[field]['value']);
                    }
                });
                if(status === 0){
                    result.pop();
                    grid.def.drag.status = false;
                    return false;
                }
            }
        });
    });
    grid.def.data.records = result;
    if(grid.def.paginator.enable && !grid.def.paginator.proxy){
        grid.set.total(result.length);
        grid.reCalculatePaginator();
    }
    grid.scroll_update_status = true;
    grid.renderBody();
    grid.def.itemsoperate.callback && grid.def.itemsoperate.callback({field: this.current_field, action: 'filter-data'});
    _this.close();
};
AppGridItemOperate.prototype.doFilter = function(rule, target){
    if($.isNumeric(target)){
        target = +target;
    }
    if($.isNumeric(rule.value)){
        rule.value = +rule.value;
    }
    switch(rule.type){
        case '1':
            target += '';
            rule.value += '';
            return target.indexOf(rule.value) != -1;
        case '2':
            return target > rule.value;
        case '3':
            return target == rule.value;
        case '4':
            return target < rule.value;
        case '5':
            return target != rule.value;
        case '6':
            return target == rule.value;
        default:
            return false;
    }
};
AppGridItemOperate.prototype.close = function(){
    this.filter_place.hide();
    this.operate_place.hide();
};

/**
 * 自定义列处理逻辑
 * @param setting
 */
AppGridColumnsSetting = function(setting){
    this.setting = setting.setting;
    this.grid = setting.grid;
    this.init();
};
AppGridColumnsSetting.prototype.init = function(){
    var _this = this, grid = _this.grid;
    _this.content = {};
    _this.selected = [];
    _this.mapping_relation = {};
    _this.file_to_mapping_relation_index = {};
    $.each(grid.init_items, function(field, item){
        var table_name = item.name;
        if(grid.field_to_items[field]){
            table_name = grid.field_to_items[field]['name'];
        }
        if(_this.content[table_name] === undefined){
            _this.content[table_name] = [];
        }
        _this.content[table_name].push({value: field, text: item.title.filterHtml(), locked: item.locked});
        var path = item.path.split('-');
        if(path.length > 2){
            //path路径长度大于2，则必然是分层结构，拖动的时候需要放在一起
            var path_str = path['0'] + path['1'];
            if(_this.mapping_relation[path_str] === undefined){
                _this.mapping_relation[path_str] = [];
            }
            _this.mapping_relation[path_str].push(field);
            _this.file_to_mapping_relation_index[field] = path_str;
        }
    });
    $.each(grid.index_to_field, function(index, field){
        _this.selected.push(field);
    });
    _this.dialog();
};
AppGridColumnsSetting.prototype.dialog = function(){
    this.checkbox = {};
    var _this = this, grid = _this.grid;
    var dialog = new AppGridDialog({
        title: _this.grid.def.toolbar.setting.text.filterHtml(),
        style: {width: _this.setting.width || 540},
        content: '<div id="agttsc-tool-'+grid.def.id+'" class="agtt-item-place" style="padding:5px 0 5px 15px;"></div><div class="agtt-item-place"><div id="agttsc-body-'+grid.def.id+'"></div></div>'
    });
    var body = dialog.render.find('#agttsc-body-'+grid.def.id);
    new AppGridUtilityR({
        render: '#agttsc-tool-' + grid.def.id,
        style: 'margin-right:10px;display:inline-block;cursor:pointer;',
        items: [{value: '1', text: '初始'}, {value: '2', text: '全选'}, {value: '3', text: '反选'}],
        value: {value: '1'},
        callback: function(item){
            switch (item.value){
                case '1':
                    $.each(_this.checkbox, function(name, checkbox){checkbox.set(_this.selected);});
                    break;
                case '2':
                    $.each(_this.checkbox, function(name, checkbox){checkbox.setAll();});
                    break;
                case '3':
                    $.each(_this.checkbox, function(name, checkbox){checkbox.reverseAll();});
                    break;
            }
        }
    });
    $.each(_this.content, function(name, columns){
        body.append('<div id="agttsc-'+name+'" _name="'+name+'" class="agtt-item-place-line"><div>');
        _this.checkbox[name] = new AppGridUtilityC({
            render: '#agttsc-'+name,
            items: columns,
            style: 'display:inline-block;width:100px;',
            title: true
        });
        _this.checkbox[name].set(_this.selected);
    });
    dialog.render.find('.agt-dialog-confirm').click(function(){
        var display = {}, str = [], items_order = {};
        $.each(_this.checkbox, function(name, box){
            var items = box.get();
            items_order[name] = [];
            items.length && $.each(items, function(i, item){
                display[item.value] = true;
                str.push(item.value);
                items_order[name].push(item.value);
            });
        });
        if(grid.def.toolbar.setting.storage !== false && window.localStorage){
            localStorage.setItem(grid.getStorageKey('item-setting'), str.join(';'));
            grid.storage_display = display;
        }
        _this.drag_status && _this.changeItemsOrder(items_order);
        grid.set.display(display, false);
		grid.def.toolbar.setting.callback && grid.def.toolbar.setting.callback.apply(grid,display);
        dialog.close();
    });
    dialog.render.find('.agt-dialog-cancel, .agt-dialog-close').click(function(){
        dialog.close();
    });
    if(_this.grid.def.toolbar.setting.draggable){
        _this.drag_cover_place = $('<span class="agtc-box-label agt-text-overflow agtc-box-label-cover" style="display:inline-block;width:98px;"></span>');
        _this.drag_status = false;
        dialog.render.on('mouseenter', '.agtc-box-text', function(){
            if(!$(this).prev().hasClass('agti-check-locked')){
                _this.drag($(this), dialog.render);
            }
        });
    }
};
/**
 * 修改配置文件中列顺序
 * @param orders
 */
AppGridColumnsSetting.prototype.changeItemsOrder = function(orders){
    var grid = this.grid;
    var columns = $.extend(true, [], grid.init_columns);
    var did_deep_items = {};
    $.each(columns, function(index, column){
        var order = orders[column.name];
        column.items = [];
        $.each(order, function(key, field){
            var item = grid.field_to_items[field];
            var path = item.path.split('-');
            if(path.length == 2){
                column.items.push(item);
            }else{
                if(did_deep_items[path['0'] + path['1']] === undefined){
                    item = $.extend(true, {}, grid.def.columns[path['0']].items[path['1']]);
                    did_deep_items[path['0'] + path['1']] = true;
                    column.items.push(item);
                }
            }
        });
    });
    grid.def.columns = columns;
};
AppGridColumnsSetting.prototype.drag = function(handle, wapper){
    var _this = this;
    var config = {
        handle: handle,
        container: wapper,
        enableLeft: true,
        proxy: function(source){
            var drag_content = $('<div/>').css({'z-index': 1001, 'position': 'fixed'});
            var field = source.attr('value');
            if(_this.file_to_mapping_relation_index[field]){
                var parent = source.parent();
                $.each(_this.mapping_relation[_this.file_to_mapping_relation_index[field]], function(index, item){
                    var items_block = parent.find('.agtc-box-label[value="'+item+'"]');
                    drag_content.append(items_block.clone());
                    if(field != item){
                        items_block.remove();
                    }
                });
            }else{
                drag_content.append(source.clone());
            }
            drag_content.appendTo('body');
            source.before(_this.drag_cover_place.outerHeight(source.height()).outerWidth(drag_content.width()));
            source.remove();
            return drag_content;
        },
        onStartDrag: function(data){
            data.startLeft = _this.drag_cover_place.offset().left;
            data.proxy.css({left: data.startLeft});
            _this.drag_status = true;
        },
        onMoveDrag: function(data){
            if(data.startCX == data.clientX && data.startCY == data.clientY){
                return true;
            }
            var doc = $(document.elementFromPoint(data.left - 1, data.clientY));
            if(doc.hasClass('agtc-box-label-cover')){
                return true;
            }else{
                if(doc.hasClass('agt-text-overflow')){
                    if(doc.prev().length == 0){
                        doc.before(_this.drag_cover_place);
                    }else{
                        var field = doc.attr('value');
                        if(_this.file_to_mapping_relation_index[field]){
                            var relation = _this.mapping_relation[_this.file_to_mapping_relation_index[field]];
                            var relation_last_field = relation[relation.length - 1];
                            doc = doc.parent().find('.agt-text-overflow[value="'+relation_last_field+'"]');
                        }
                        doc.after(_this.drag_cover_place);
                    }
                }
            }
        },
        onStopDrag: function(data){
            _this.drag_cover_place.before(data.proxy.children());
            _this.drag_cover_place.remove();
        }
    };
    new AppGridDragBase(config);
};

/**
 * 打开一个空行
 * @param index 列表的行号，打开的空行位于此行之后
 */
AppGrid.prototype.openEmptyLine = function(index){
    var _this = this, result = {};
    $.each(_this.render, function(id, render){
        var target = render.grid_tbody;
        if(target.find('#empty-for-'+id+'-line-'+index).length){
            target.find('#empty-for-'+id+'-line-'+index).show();
        }else{
            var colspan = render.column.dimension_items.length;
            var content_id = 'empty-content-'+id+'-line-'+index;
            var line = '<tr id="empty-for-'+id+'-line-'+index+'" class="agt-empty-line" _table_id="'+id+'"><td id="'+content_id+'" colspan="'+colspan+'" class="agt-empty-col"></td></tr>';
            target.find('#' + id + '-line-' + index).after(line);
            result[id] = content_id;
        }
    });
    return result;
};
/**
 * 关闭一个空行
 * @param index 列表的行号，关闭的空行位于此行之后
 */
AppGrid.prototype.closeEmptyLine = function(index){
    var _this = this;
    $.each(_this.render, function(id, render){
        render.grid_tbody.find('#empty-for-' + id + '-line-' + index).remove();
    });
};
/**
 * 隐藏一个空行
 * @param index 列表的行号，关闭的空行位于此行之后
 */
AppGrid.prototype.hideEmptyLine = function(index){
    var _this = this;
    $.each(_this.render, function(id, render){
        render.grid_tbody.find('#empty-for-' + id + '-line-' + index).hide();
    });
};


/**
 * 表格翻页控件
 */
var AppPaginator = function(setting){
    var _self = this;
    _self.def = {
            id: '',
            total: 0,
            display_page: 5,
            items: [],
            page_index: 1,
            page_size: 10,
            callback: null
    };
    $.extend(true, _self.def, setting);
    _self.last_index = _self.def.page_index;
    _self.last_size = _self.def.page_size;
    _self.items_map = {};
    _self.plus = function(v) {return v - (-1);},
    _self.minus = function(v) {return v - 1;},
    _self.last = function() {return Math.ceil(_self.def.total / _self.def.page_size);};
    _self.create();
};
AppPaginator.prototype.create = function(){
	var _self = this;	
	_self.el_paginator = $('<span class="agt-inline-block"/>').append(
			_self.el_first = $('<span onselectstart="return false;" class="agtp-nav agt-inline-block agtp-first">&nbsp;</span>').bind('click', function() {
				if (!$(this).hasClass('disabled')) {
					_self.set('page_index', 1, true);
				}
			})
	).append(
			_self.el_prev = $('<span onselectstart="return false;" class="agtp-nav agt-inline-block agtp-prev">&nbsp;</span>').bind('click',function() {
				if (!$(this).hasClass('disabled')) {
					_self.set('page_index', _self.minus(_self.def.page_index), true);
				}
			})
	).append(
			_self.el_pages = $('<span onselectstart="return false;" class="agt-inline-block"></span>').delegate('span:not(.agt-activate-page)', 'click', function() {
				_self.set('page_index', $(this).html() - 0, true);
			}).appGridHoverClass('span', 'hover')
	).append(
			_self.el_next = $('<span onselectstart="return false;" class="agtp-nav agt-inline-block agtp-next">&nbsp;</span>').bind('click', function() {
				if (!$(this).hasClass('disabled')) {
					_self.set('page_index', _self.plus(_self.def.page_index), true);
				}
			})
	).append(
			_self.el_last = $('<span onselectstart="return false;" class="agtp-nav agt-inline-block agtp-last">&nbsp;</span>').bind('click', function() {
				if (!$(this).hasClass('disabled')) {
					_self.set('page_index', _self.last(), true);
				}
			})
	).append(
			_self.el_page_size_info = $('<span class="agtp-number agtp-size-info agt-inline-block"/>')
	).append(
			_self.el_loading = $('<span class="agtp-number agtp-loading agt-inline-block">&nbsp;</span>')
	);
	_self.el = $('<div/>').addClass('agtp-toolbar');
	_self.el.append('<span class="agtp-toolbar-label">每页显示：</span>');
	_self.el.append(_self.paginator_select = $('<span id="'+_self.def.id+'-select" class="agtp-toolbar-select"/>'));
	_self.el.append($('<span id="'+_self.def.id+'-buttons" class="agtp-toolbar-pages"/>').append(_self.el_paginator));
	$('#' + _self.def.id).empty().append(_self.el);
	_self.page_select = new AppGridUtilityS({
		id: _self.paginator_select,
		body: false,
		items: _self.def.items,
		value: _self.def.page_size,
		width: 60,
		callback: function(items){
			_self.last_size = _self.def.page_size;
			_self.def.page_size = parseInt(items.value);
			_self.set('page_index', 1, true);
		}
	});
	_self.set('total', _self.def.total);
};
AppPaginator.prototype.refresh = function(sign){
    var _self = this, page_number = Math.ceil(_self.def.total / _self.def.page_size);
    if (_self.def.page_size && _self.def.total && _self.def.page_index) {
        var half =  Math.floor(_self.def.display_page / 2);
        var start = Math.max(Math.min(page_number - _self.def.display_page + 1, _self.def.page_index - half), 1);
        var html = $.map(new Array(Math.min(_self.def.display_page, page_number)), function(_, i) {
            return '<span class="agtp-number agt-inline-block">'+(i + start)+'</span>';
        }).join('');
        _self.el_pages.html(html).find('span.agtp-number').eq(_self.def.page_index - start).addClass('agt-activate-page');
        _self.el.find('.agtp-nav').removeClass('disabled');
        if (_self.def.page_index == 1) {
            _self.el_first.addClass('disabled');
            _self.el_prev.addClass('disabled');
        }
        if (_self.def.page_index >= page_number) {
            _self.el_next.addClass('disabled');
            _self.el_last.addClass('disabled');
        }
        sign === true && _self.def.callback && _self.def.callback.call(this, {last_index: _self.last_index, last_size: _self.last_size, page_index: _self.def.page_index, page_size: _self.def.page_size}, _self.def.id);
    }
};
AppPaginator.prototype.set = function(type, data, sign){
    switch(type){
        case 'total':
            this.def.total = parseInt(data);
            this.el_page_size_info.html('共'+data+'条记录');
            this.refresh(sign);
            break;
        case 'page_index':
            this.last_index = this.def.page_index;
            this.def.page_index = parseInt(data);
            this.refresh(sign);
            break;
        case 'page_size':
            this.last_size = this.def.page_size;
            this.def.page_size = parseInt(data);
            this.page_select.set(this.def.page_size);
            if(sign === true){
                this.set('page_index', 1, true);
            }else{
                this.refresh(false);
            }
            break;
        case 'loading':
            if (data) {
                this.el_page_size_info.hide();
                this.el_loading.css('display', 'inline-block');
            } else {
                this.el_page_size_info.show();
                this.el_loading.css('display', 'none');
            }
            break;
    }
};

AppGridPaginator = function(_self){
	var _this = this;
	_this.grid = _self;
	_this.paginator = new AppPaginator({
		id: 'page-' + _self.def.id,
		total: _self.def.data.total,
		items: _self.def.paginator.page_items,
		page_size: _self.def.paginator.page_size,
		page_index: _self.def.paginator.page_index,
		callback: function(params){
			_this.callback(params);
		}
	});
};
AppGridPaginator.prototype.set = function(type, data, sign){
    this.paginator.set(type, data, sign);
};
AppGridPaginator.prototype.callback = function(params){
    if(this.grid.def.paginator.proxy){
        var items = {last_index: params.last_index, last_size: params.last_size, page_index: params.page_index, page_size: params.page_size};
        if(this.grid.def.sortable.enable){
            items.sort_field = this.grid.def.sortable.sort_field;
            items.sort_asc = this.grid.def.sortable.sort_asc;
        }
        this.grid.def.paginator.proxy.call(this.grid, items);
    }else{
        if(this.grid.def.paginator.page_size != params.page_size){
            this.grid.def.paginator.page_size = params.page_size;
            this.grid.reCalculatePaginator();
        }
        this.grid.def.paginator.page_index = params.page_index;
        this.grid.renderBody();
    }
};

(function ($) {
  $.fn.appresize = function (_1, _2) {
    if (typeof _1 == 'string') {
      return $.fn.appresize.methods[_1](this, _2);
    }
    function _3(e) {
      var _4 = e.data;
      var _5 = $.data(_4.target, 'appresize').options;
      if (_4.dir.indexOf('e') != - 1) {
        var _6 = _4.startWidth + e.pageX - _4.startX;
        _6 = Math.min(Math.max(_6, _5.minWidth), _5.maxWidth);
        _4.width = _6;
      }
      if (_4.dir.indexOf('s') != - 1) {
        var _7 = _4.startHeight + e.pageY - _4.startY;
        _7 = Math.min(Math.max(_7, _5.minHeight), _5.maxHeight);
        _4.height = _7;
      }
      if (_4.dir.indexOf('w') != - 1) {
        var _6 = _4.startWidth - e.pageX + _4.startX;
        _6 = Math.min(Math.max(_6, _5.minWidth), _5.maxWidth);
        _4.width = _6;
        _4.left = _4.startLeft + _4.startWidth - _4.width;
      }
      if (_4.dir.indexOf('n') != - 1) {
        var _7 = _4.startHeight - e.pageY + _4.startY;
        _7 = Math.min(Math.max(_7, _5.minHeight), _5.maxHeight);
        _4.height = _7;
        _4.top = _4.startTop + _4.startHeight - _4.height;
      }
    };
    function _8(e) {
      var _9 = e.data;
      var t = $(_9.target);
      t.css({
        left: _9.left,
        top: _9.top
      });
      if (t.outerWidth() != _9.width) {
        t.outerWidth(_9.width);
      }
      if (t.outerHeight() != _9.height) {
        t.outerHeight(_9.height);
      }
    };
    function _a(e) {
      $.fn.appresize.isResizing = true;
      $.data(e.data.target, 'appresize').options.onStartResize.call(e.data.target, e);
      return false;
    };
    function _b(e) {
      _3(e);
	      $.data(e.data.target, 'appresize').options.onResize.call(e.data.target, e);
      return false;
    };
    function _c(e) {
      $.fn.appresize.isResizing = false;
      _3(e);
      $.data(e.data.target, 'appresize').options.onStopResize.call(e.data.target, e);
      $(document).unbind('.appresize');
      $('body').css('cursor', '');
      return false;
    };
    return this.each(function () {
      var _d = null;
      var _e = $.data(this, 'appresize');
      if (_e) {
        $(this).unbind('.appresize');
        _d = $.extend(_e.options, _1 || {
        });
      } else {
        _d = $.extend({
        }, $.fn.appresize.defaults, _1 || {
        });
        $.data(this, 'appresize', {
          options: _d
        });
      }
      if (_d.disabled == true) {
        return;
      }
      $(this).bind('mousemove.appresize', {
        target: this
      }, function (e) {
        if ($.fn.appresize.isResizing) {
          return;
        }
        var _f = _10(e);
        if (_f == '') {
          $(e.data.target).css('cursor', '');
        } else {
          $(e.data.target).css('cursor', _f + '-resize');
        }
      }).bind('mouseleave.appresize', {
        target: this
      }, function (e) {
        $(e.data.target).css('cursor', '');
      }).bind('mousedown.appresize', {
        target: this
      }, function (e) {
        var dir = _10(e);
        if (dir == '') {
          return;
        }
        function _11(css) {
          var val = parseInt($(e.data.target).css(css));
          if (isNaN(val)) {
            return 0;
          } else {
            return val;
          }
        };
        var _12 = {
          target: e.data.target,
          dir: dir,
          startLeft: _11('left'),
          startTop: _11('top'),
          left: _11('left'),
          top: _11('top'),
          startX: e.pageX,
          startY: e.pageY,
          startWidth: $(e.data.target).outerWidth(),
          startHeight: $(e.data.target).outerHeight(),
          width: $(e.data.target).outerWidth(),
          height: $(e.data.target).outerHeight(),
          deltaWidth: $(e.data.target).outerWidth() - $(e.data.target).width(),
          deltaHeight: $(e.data.target).outerHeight() - $(e.data.target).height()
        };
        $(document).bind('mousedown.appresize', _12, _a);
        $(document).bind('mousemove.appresize', _12, _b);
        $(document).bind('mouseup.appresize', _12, _c);
        $('body').css('cursor', dir + '-resize');
      });
      function _10(e) {
        var tt = $(e.data.target);
        var dir = '';
        var _13 = tt.offset();
        var _14 = tt.outerWidth();
        var _15 = tt.outerHeight();
        var _16 = _d.edge;
        if (e.pageY > _13.top && e.pageY < _13.top + _16) {
          dir += 'n';
        } else {
          if (e.pageY < _13.top + _15 && e.pageY > _13.top + _15 - _16) {
            dir += 's';
          }
        }
        if (e.pageX > _13.left && e.pageX < _13.left + _16) {
          dir += 'w';
        } else {
          if (e.pageX < _13.left + _14 && e.pageX > _13.left + _14 - _16) {
            dir += 'e';
          }
        }
        var _17 = _d.handles.split(',');
        for (var i = 0; i < _17.length; i++) {
          var _18 = _17[i].replace(/(^\s*)|(\s*$)/g, '');
          if (_18 == 'all' || _18 == dir) {
            return dir;
          }
        }
        return '';
      };
    });
  };
  $.fn.appresize.methods = {
    options: function (jq) {
      return $.data(jq[0], 'appresize').options;
    },
    enable: function (jq) {
      return jq.each(function () {
        $(this).appresize({
          disabled: false
        });
      });
    },
    disable: function (jq) {
      return jq.each(function () {
        $(this).appresize({
          disabled: true
        });
      });
    }
  };
  $.fn.appresize.defaults = {
    disabled: false,
    handles: 'n, e, s, w, ne, se, sw, nw, all',
    minWidth: 10,
    minHeight: 10,
    maxWidth: 10000,
    maxHeight: 10000,
    edge: 5,
    onStartResize: function (e) {},
    onResize: function (e) {},
    onStopResize: function (e) {}
  };
  $.fn.appresize.isResizing = false;
}) (jQuery);

var AppGridResize = function(grid){
    var _this = this;
    _this.grid = grid;
    _this.table_id = '';
    _this.render = null;
    _this.field = '';
    _this.holder = {};
    grid.head_render.find(grid.def.resize.handle).appresize({
        handles: 'e',
        minWidth: grid.def.resize.min,
        maxWidth: grid.def.resize.max,
        onStartResize: function(e){
            var target = $(e.data.target), table_id = $(e.data.target).attr('_table_id'), split = table_id.split('-');
            split.pop();
            _this.table_id = split.join('-');
            _this.render = grid.render[_this.table_id];
            _this.field = target.attr('_field');
            switch(grid.def.resize.type){
                case '1':
                    _this.holder['next'] = [];
                    _this.holder['prev'] = [];
                    $(e.data.target).prevAll().each(function(){
                        _this.holder['prev'].unshift({field: $(this).attr('_field'), width: $(this).width()});
                    }).end().nextAll().each(function(){
                        _this.holder['next'].push({field: $(this).attr('_field'), width: $(this).width()});
                    });
                    break;
                case '2':
                    _this.holder['next'] = [];
                    _this.holder['prev'] = [];
                    _this.holder['width'] = _this.render['head_thead'].width();
                    $.each(grid.render, function(id, render){
                        if(render['column']['frozen'] !== true){
                            _this.holder['next'].push({table_id: id, width: render['head_thead'].width()});
                        }
                    });
                    break;
            }
        },
        onResize: function(e){
            var resize = grid.field_to_items[_this.field]['resize'], max = resize['max'] || 400, min = resize['min'] || 50;
            _this.max = resize['max'] || 400;
            _this.min = resize['min'] || 50;
            if(e.data.width >= max || e.data.width <= min){
                return false;
            }
				_this.resize(e) && typeof grid.def.resize.onresize == 'function' && grid.def.resize.onresize.call(null, {width: e.data.width, field: _this.field});
        },
        onStopResize: function(e){
            var width = $(e.data.target).outerWidth();
            _this.storage(width);
            grid.scroll_obj && $.each(grid.scroll_obj, function(index, obj){
                obj.update();
            });
				typeof grid.def.resize.onstop == 'function' && grid.def.resize.onstop.call(null, {width: e.data.width, field: _this.field});
        }
    });
};
AppGridResize.prototype.storage = function(width){
    var grid = this.grid, field = this.field;
    if(grid.def.resize.storage !== false && window.localStorage){
        var key = grid.getStorageKey('item-resize');
        var items = localStorage.getItem(key);
        if(items){
            var exist = false, res = [];
            $.each(items.split(';'), function(index, item){
                if(item.split(':')['0'] == field){
                    res.push(field + ':' + width);
                    exist = true;
                }else{
                    res.push(item);
                }
            });
            exist === false && res.push(field + ':' + width);
            localStorage.setItem(key, res.join(';'));
        }else{
            localStorage.setItem(key, field + ':' + width);
        }
    }
};
AppGridResize.prototype.resize = function(e){
    switch(this.grid.def.resize.type){
        case '1':
            return this.equal(e);
        case '2':
            return this.right(e);
        default:
            return false;
    }
};
AppGridResize.prototype.right = function(e){
    if(this.grid.columns.length == 1){
        return this.equal(e);
    }
    var width = e.data.width, _this = this, difference = width - e.data.startWidth + e.data.deltaWidth, size_width = 0;
    if(_this.render['column']['dimension_items'].length <= 1){
        return false;
    }
    var action = function(w){
        _this.render['head_group'].find('col[_field="'+_this.field+'"]').css({width: w});
			_this.render['body_group'].find('col[_field="'+_this.field+'"]').css({width: w});
			_this.render['foot_group'].find('col[_field="'+_this.field+'"]').css({width: w});
    };
    if(_this.render['column']['frozen'] !== true){
        action(width);
        return true;
    }else{
        if(_this.holder['next'].length == 0 && _this.holder['prev'].length == 0){
            return this.equal(e);
        }
        _this.holder['next'].length && $.each(_this.holder['next'], function(index, next){
            //至少保证50个像素的显示
            if(next.width - difference >= 50){
                size_width += difference;
                return false;
            }else{
                var temp = next.width - 50;
                size_width += temp;
                difference -= temp;
            }
        });
			_this.render['head_place'].width(_this.holder['width'] + size_width);
			_this.render['body_place'].width(_this.holder['width'] + size_width);
			_this.render['foot_place'].width(_this.holder['width'] + size_width);
			_this.render['bars_place'].width(_this.holder['width'] + size_width);
			action(width);
        return true;
    }
};
AppGridResize.prototype.equal = function(e, p){
    var width = e.data.width, _this = this, difference = width - e.data.startWidth + e.data.deltaWidth, result = false;
    if(_this.render['column']['dimension_items'].length <= 1){
        return false;
    }
    var action = function(field, w){
			_this.render['head_group'].find('col[_field="'+field+'"]').css({width: w});
			_this.render['body_group'].find('col[_field="'+field+'"]').css({width: w});
			_this.render['foot_group'].find('col[_field="'+field+'"]').css({width: w});
    };
    if(_this.render['column']['frozen'] !== true){
        result = true;
    }else{
        $.each(_this.holder['next'], function(i, next){
            if(next.width - difference >= _this.min){
                action(next.field, next.width - difference);
                difference = 0;
                result = true;
                return false;
            }else{
                action(next.field, _this.min);
                difference -= next.width - _this.min;
            }
        });
        difference > 0 && $.each(_this.holder['prev'], function(i, prev){
            if(prev.width - difference >= _this.min){
                action(prev.field, prev.width - difference);
                result = true;
                return false;
            }else{
                action(prev.field, _this.min);
                difference -= prev.width - _this.min;
            }
        });
    }
    result && action(_this.field, width);
    return result;
};

(function($) {
    var types = ['DOMMouseScroll', 'mousewheel'];
    if ($.event.fixHooks) {
        for ( var i=types.length; i; ) {
            $.event.fixHooks[ types[--i] ] = $.event.mouseHooks;
        }
    }
    $.event.special.mousewheel = {
        setup: function() {
            if ( this.addEventListener ) {
                for ( var i=types.length; i; ) {
                    this.addEventListener( types[--i], handler, false );
                }
            } else {
                this.onmousewheel = handler;
            }
        },
        teardown: function() {
            if ( this.removeEventListener ) {
                for ( var i=types.length; i; ) {
                    this.removeEventListener( types[--i], handler, false );
                }
            } else {
                this.onmousewheel = null;
            }
        }
    };
    $.fn.extend({
        appmousewheel: function(fn) {
            return fn ? this.bind("mousewheel", fn) : this.trigger("mousewheel");
        },
        unappmousewheel: function(fn) {
            return this.unbind("mousewheel", fn);
        }
    });
    function handler(event) {
        var orgEvent = event || window.event, args = [].slice.call( arguments, 1 ), delta = 0, deltaX = 0, deltaY = 0;
        event = $.event.fix(orgEvent);
        event.type = "mousewheel";
        if ( orgEvent.wheelDelta ) { delta = orgEvent.wheelDelta/120; }
        if ( orgEvent.detail     ) { delta = -orgEvent.detail/3; }
        deltaY = delta;
        if ( orgEvent.axis !== undefined && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
            deltaY = 0;
            deltaX = -1*delta;
        }
        if ( orgEvent.wheelDeltaY !== undefined ) { deltaY = orgEvent.wheelDeltaY/120; }
        if ( orgEvent.wheelDeltaX !== undefined ) { deltaX = -1*orgEvent.wheelDeltaX/120; }
        args.unshift(event, delta, deltaX, deltaY);
        return ($.event.dispatch || $.event.handle).apply(this, args);
    }
})(jQuery);
	var AppGridBar = function(setting, grid){
    this.options = {
            axis: 'x',
            wheel: 29,
            render: '',
            target: '',
            place: '.agt-place-bar',
            content: '.agt-main',
            sync: [],
            enablewheel: true,
            place_height: 0,
            content_height: 0,
            visible: true,
            callback: null
    };
    $.extend(this.options, setting);
		this.grid = grid;
    this.init();
};
AppGridBar.prototype.init = function(){
    var render = $(this.options.render), target = $(this.options.target), _this = this;
		render.append('<div class="agt-bars-handle agt-bars-'+this.options.axis+'"><div class="agt-track-'+this.options.axis+'"></div><div class="agt-thumb-'+this.options.axis+'" ></div></div>');
		render.addClass('agt-bars-' + this.options.axis + '-place');
    this.place = {obj: target.find(this.options.place)};
    this.content = {obj: target.find(this.options.content)};
		this.scrollbar = {obj: render.find('.agt-bars-'+this.options.axis)};
    this.track = {obj: this.scrollbar.obj.find('.agt-track-'+this.options.axis)};
    this.thumb = {obj: this.scrollbar.obj.find('.agt-thumb-'+this.options.axis)};
    this.direction = this.options.axis == 'x' ? 'left' : 'top';
    this.size = this.options.axis == 'x' ? 'width' : 'height';
    this.scroll = 0;
    this.last_scroll = null;
    this.last_auto = null;
    this.last_page_size = 0;
    this.position = {start: 0, now: 0};
    this.mouse = {};
    this.content_css = 0;
    this.thumb_css = 0;
    this.enable = true;
    this.func_drag = function(event){
        _this.drag(event);
    };
    this.func_end = function(event){
        _this.thumb.obj.removeClass('agt-active');
        _this.end(event);
    };
    this.thumb.obj.bind('mousedown touchstart', function(event){
        $('body').click();//触发一次全局click，激活其它控件隐藏事件
        _this.thumb.obj.addClass('agt-active');
        _this.start(event);
    });
    this.track.obj.bind('click', this.func_drag);
    var wheelbuffer = 0;
    this.options.enablewheel && render.appmousewheel(function(e, delta){
        if(!(_this.content.ratio >= 1) && _this.enable){
            var w = _this.wheel(delta);
            if(w !== _this.last_scroll){
                _this.last_scroll = w;
                wheelbuffer = 0;
            }else{
                wheelbuffer++;
            }
            if(wheelbuffer < 10){
                APP_GRID_GLOBAL_OBJECT.clear(e);
            }
        }
    });
    if(this.options.axis == 'y' && this.options.visible){
        _this.scrollbar.obj.css({visibility: 'hidden'});
        render.mouseenter(function(){
            _this.scrollbar.obj.css({visibility: 'visible'});
        }).mouseleave(function(){
            _this.scrollbar.obj.css({visibility: 'hidden'});
        });
    }
    this.update(true);
};
AppGridBar.prototype.update = function(reset){
	if(!this.place.obj[0]) return;
    var options = this.options;
    this.place[options.axis] = options.axis == 'x' ? this.place.obj[0].offsetWidth : this.options.place_height ? this.options.place_height : this.place.obj[0].offsetHeight;
    this.content[options.axis] = options.axis == 'x' ? this.content.obj[0].scrollWidth : this.options.content_height ? this.options.content_height : this.content.obj[0].scrollHeight;
    this.content.ratio = this.place[options.axis] / this.content[options.axis];
    this.scrollbar.obj.toggleClass('disable', this.content.ratio >= 1);
    this.mouse['start'] = this.thumb.obj.offset()[this.direction];
    this.track.obj.css(this.size, this.place[options.axis]);
    this.track[options.axis] = options.axis == 'x' ? this.track.obj[0].offsetWidth : this.track.obj[0].offsetHeight;
    this.thumb[options.axis] = Math.min(this.track[options.axis], Math.max(0, (this.track[options.axis] * this.content.ratio)));
    this.scrollbar.ratio = this.content[options.axis] / this.track[options.axis];
    this.thumb.obj.css(this.size, this.thumb[options.axis]);
    if(reset === true){
        this.content.obj.css(this.direction, 0);
        this.thumb.obj.css(this.direction, 0);
        this.sync(0);
    }else{
			var content = this.content_css;
			if(content != 0){		
				if(this.place[this.options.axis] >= this.content[this.options.axis]){
					content = 0;
				}else{				
					if(this.place[this.options.axis] + content > this.content[this.options.axis]){
						content = this.content[this.options.axis] - this.place[this.options.axis];
					}
				}
				this.move(content, this.thumb_css);
				if(content == 0){
					this.wheel(-1);
					this.wheel(1);
				}else{					
					this.wheel(1);
					this.wheel(-1);
				}
			}
    }
};
AppGridBar.prototype.drag = function(event){
    if(!(this.content.ratio >= 1) && this.enable){
        if(event.pageX === undefined){
            event.pageX = event.originalEvent.targetTouches[0].clientX;
            event.pageY = event.originalEvent.targetTouches[0].clientY;
        }
        this.last_page_size = Math.max(0, (this.position.start + ((this.options.axis == 'x' ? event.pageX : event.pageY) - this.mouse.start)));
        this.position.now = Math.min((this.track[this.options.axis] - this.thumb[this.options.axis]), this.last_page_size);
        this.scroll = this.position.now * this.scrollbar.ratio;
        this.move(-this.scroll, this.position.now);
    }
    return false;
};
AppGridBar.prototype.wheel = function(delta, wheel){
    if(!(this.content.ratio >= 1) && this.enable){
        this.scroll -= delta * (wheel || this.options.wheel);
        this.scroll = Math.min((this.content[this.options.axis] - this.place[this.options.axis]), Math.max(0, this.scroll));
        this.move(-this.scroll, this.scroll / this.scrollbar.ratio);
        return this.scroll;
    }
};
AppGridBar.prototype.set = function(type, value){
    switch(type){
        case 'enable':
            this.enable = !!value;
            break;
        case 'position':
            if(value.direction == this.direction){
					if(this.place[this.options.axis] >= this.content[this.options.axis]){
						value.content = 0;
					}else{				
						if(this.place[this.options.axis] + value.content > this.content[this.options.axis]){
							value.content = this.content[this.options.axis] - this.place[this.options.axis];
						}
					}
					this.scroll = -value.content;
					this.move(value.content, value.thumb);
					if(value.content == 0){
						this.wheel(-1);
						this.wheel(1);
					}else{					
						this.wheel(1);
						this.wheel(-1);
					}
            }
            break;
        case 'height':
            if(value.content_height){
                this.options.content_height = value.content_height;
            }
            if(value.place_height){
                this.options.place_height = value.place_height;
            }
            this.update(true);
            break;
    }
};
AppGridBar.prototype.get = function(type){
    switch(type){
        case 'position':
            return {direction: this.direction, content: this.content_css, thumb: this.thumb_css};
            break;
    }
};
AppGridBar.prototype.start = function(event){
    if(event.pageX === undefined){
        event.pageX = event.originalEvent.targetTouches[0].clientX;
        event.pageY = event.originalEvent.targetTouches[0].clientY;
    }
    this.mouse.start = this.options.axis == 'x' ? event.pageX : event.pageY;
    this.position.start = parseInt(this.thumb.obj.css(this.direction));
    $(document).bind('mousemove touchmove', this.func_drag).bind('mouseup touchend', this.func_end);
    this.thumb.obj.bind('mouseup touchend', this.func_end);
    $('body').attr('onselectstart', 'return false;').css({'-moz-user-select': 'none'});
    return false;
};
AppGridBar.prototype.end = function(event){
    $(document).unbind('mousemove touchmove', this.func_drag).unbind('mouseup touchend', this.func_end);
    this.thumb.obj.unbind('mouseup touchend', this.func_end);
    $('body').removeAttr('onselectstart').css({'-moz-user-select': '-moz-all'});
    return false;
};
AppGridBar.prototype.auto = function(params){
    var _this = this;
    var delta = '';
    var time = null;
    time = setInterval(function(){
        delta = _this.wheel(params.type ? -1 : 1, params.wheel ? params.wheel : _this.options.wheel);
        if((params.limit && params.limit <= delta) || delta === _this.last_auto){
            clearInterval(time);
            params.callback && params.callback();
        }else{
            _this.last_auto = delta;
        }
    }, params.min || 50);
};
AppGridBar.prototype.move = function(content, thumb){
    content = content || 0;
    thumb = thumb || 0;
    this.thumb_css = thumb;
    this.content_css = content;
    this.content.obj.css(this.direction, content);
    this.thumb.obj.css(this.direction, thumb);
    this.sync(content);
    this.options.callback && this.options.callback.call(null, {direction: this.direction, content: content, thumb: thumb});
};
AppGridBar.prototype.sync = function(content){
    for(var i = 0, l = this.options.sync.length; i < l; i++){
        this.options.sync[i].css(this.direction, content);
    }
};

//拖动选择
var AppGridSelection = function(grid){
    var _this = this, select = false, startX = null, startY = null, endX = null, endY = null, hidden = null, button = grid.def.selection.mouse == 'left' ? 0 : 2;
    _this.grid = grid;
    _this.overflow = $('body').css('overflow');
    grid.grid.on('click', '#agtds-cover', function(){
        _this.close();
    });
		grid.grid.on('mousedown', '#body-'+ grid.def.id, function(e){
        if(e.button == button){
            _this.data = null;
            select = true;
            startX = e.clientX + $(window).scrollLeft();
            startY = e.clientY + $(window).scrollTop();
            _this.select_div = $('<div id="agtds" />').css({top: startY, left: startX}).appendTo('body');
            APP_GRID_GLOBAL_OBJECT.clear(e);
        }
        $(document).on('mouseup.appselection', 'body', function(){
            _this.close();
        });
		}).on('mousemove', '#body-'+ grid.def.id, function(e){
        if(select && (e.buttons == button || e.button == button)) {
            var change = 2; //调整2像素的距离，保证鼠标落点在表格上而不是在选择框上
            if(hidden === null){
                hidden = true;
                var style = {'cursor': 'default'};
                if(grid.def.section.enable){
                    //分段输出时，固定选择框
                    style['overflow'] = 'hidden';
                    $(document).delegate('mousedown.appselection', 'body', function(e){
                        if(e.button == 1){
                            return false;
                        }
                    });
                }
                grid.def.section.enable && (style['overflow'] = 'hidden');
                $('body').css(style);
            }
            var target = null;
            if(e.target.tagName.toLowerCase() == 'td'){
                target = $(e.target);
            }else{
                target = $(e.target).parents('td');
            }
            var field = target.attr('_field'), index = target.parent().attr('_index'), table = target.parent().attr('_table_id');
            if(field != undefined && index != undefined && field != 'checkbox' && !target.hasClass('agc-tfoot')){
                index = parseInt(index);
                if(_this.data === null){
                    _this.data = {
                            start_field: field,
                            start_index: index,
                            start_table: table
                    };
                }else{
                    _this.data.end_field = field;
                    _this.data.end_index = index;
                    _this.data.end_table = table;
                }
            }
            _this.position = {top: 0, left: 0, width: 0, height: 0};
            endX = e.clientX + $(window).scrollLeft();
            endY = e.clientY + $(window).scrollTop();
            if(endY < startY){
                _this.position.top = endY + change;
                _this.position.height = Math.abs(endY - startY);
            }else{
                _this.position.top = startY;
                _this.position.height = Math.abs(endY - startY) - change;
            }
            if(endX < startX){
                _this.position.left = endX + change;
                _this.position.width = Math.abs(endX - startX);
            }else{
                _this.position.left = startX;
                _this.position.width = Math.abs(endX - startX) - change;
            }
            _this.select_div && _this.select_div.show().css(_this.position);
            APP_GRID_GLOBAL_OBJECT.clear(e);
        }
		}).on('mouseup', '#body-'+ grid.def.id, function(e){
        if(select && (e.buttons == button || e.button == button)){
            select = false;
            if(_this.data){
                if(endY < startY){
                    var tmp = _this.data.end_index;
                    _this.data.end_index = _this.data.start_index;
                    _this.data.start_index = tmp;
                }
                if(endX < startX){
                    var tmp = _this.data.end_field, tmp_table = _this.data.end_table;
                    _this.data.end_field = _this.data.start_field;
                    _this.data.start_field = tmp;
                    _this.data.end_table = _this.data.start_table;
                    _this.data.start_table = tmp_table;
                }
                var selected = {
                    topLeft : {
                        obj: $('#' + _this.data.start_table + '-line-' + _this.data.start_index).children('.agt-col-'+_this.data.start_field),
                        table: $('#' + _this.data.start_table).position(),
                        parent: $('#' + _this.data.start_table + '-place').position()
                    },
                    rightBottom : {
                        obj: $('#' + _this.data.end_table + '-line-' + _this.data.end_index).children('.agt-col-'+_this.data.end_field),
                        table: $('#' + _this.data.end_table).position(),
                        parent: $('#' + _this.data.end_table + '-place').position()
                    }
                };
                while(selected.topLeft.obj.length == 0 && _this.data.start_index > 0){
                    _this.data.start_index--;
                    selected.topLeft.obj = $('#' + _this.data.start_table + '-line-' + _this.data.start_index).children('.agt-col-'+_this.data.start_field);
                }
                while(selected.rightBottom.obj.length == 0 && _this.data.end_index > 0){
                    _this.data.end_index--;
                    selected.rightBottom.obj = $('#' + _this.data.end_table + '-line-' + _this.data.end_index).children('.agt-col-'+_this.data.end_field);
                }
                selected.topLeft.position = selected.topLeft.obj.position();
                selected.rightBottom.position = selected.rightBottom.obj.position();
                if(selected.topLeft.position && selected.rightBottom.position){
                    selected.rightBottom.height = selected.rightBottom.obj.height();
                    selected.rightBottom.width = selected.rightBottom.obj.width();
                    _this.position.top = selected.topLeft.position.top + grid.height.head.outerHeight + grid.height.toolbar.outerHeight;
                    _this.position.left = selected.topLeft.position.left + selected.topLeft.parent.left + selected.topLeft.table.left;
                    _this.position.width = selected.rightBottom.position.left + selected.rightBottom.parent.left + selected.rightBottom.table.left + selected.rightBottom.width - selected.topLeft.table.left - selected.topLeft.position.left - selected.topLeft.parent.left - 1;
                    _this.position.height = selected.rightBottom.position.top - selected.topLeft.position.top + selected.rightBottom.height - 1;
                    if(_this.data.start_table == _this.data.end_table){
                        var place = $('#' + _this.data.start_table + '-place').position();
                        if(place.left > _this.position.left){
                            _this.position.width -= place.left - _this.position.left;
                            _this.position.left = place.left;
                        }
                    }
                    if(_this.position.width + _this.position.left > grid.width.grid){
                        _this.position.width = grid.width.grid - _this.position.left + - 2;
                    }
                    if(grid.def.rowspan.enable){
                        var rowspan_lb = selected.rightBottom.obj.attr('rowspan');
                        if(rowspan_lb > 1){
                            if(_this.data.start_index < _this.data.end_index){
                                _this.data.start_index = _this.data.end_index;
                            }
                            _this.data.end_index = parseInt(_this.data.end_index) + parseInt(rowspan_lb) - 1;
                        }
                    }
                    if(grid.def.colspan.enable){
                        var colspan_lb = selected.rightBottom.obj.attr('colspan');
                        if(colspan_lb > 1){
                            var b = false;
                            $.each(grid.columns_map, function(index, column){
                                index == _this.data.end_field && (b = true);
                                if(b && colspan_lb > 0){
                                    _this.data.end_field = index;
                                    colspan_lb--;
                                }
                            });
                        }
                    }
                    _this.cover = $('<div id="agtds-cover" />').css({width: grid.width.grid, height: grid.grid.height()}).appendTo(grid.grid);
                    _this.select_div.css(_this.position).appendTo(grid.grid);
                    _this.calculate();
                }
                $(document).off('.appselection');
            }else{
                _this.close();
            }
            $('body').css({'cursor': ''});
            startX = null, startY = null, endX = null, endY = null, hidden = null;
            APP_GRID_GLOBAL_OBJECT.clear(e);
        }
    });
};
AppGridSelection.prototype.calculate = function(){
    var field_holder = {}, start = null, select = {records: {}, mapping: null, index: []}, _this = this, grid = this.grid;
    $.each(grid.index_to_field, function(index, value){
        if(value == _this.data.end_field){
            field_holder[value] = true;
            return false;
        }else{
            if(start === true || value == _this.data.start_field){
                field_holder[value] = true;
                start = true;
            }
        }
		});
		var records = grid.get.records();
		if(records[_this.data.start_index] && records[_this.data.end_index]){
			var mapping = {};
			for(var i = _this.data.start_index; i <= _this.data.end_index; i++){
				$.each(field_holder, function(key){
					if(records[i][key] && mapping[key] === undefined){
						mapping[key] = grid.field_to_items[key];
						select.index.push(key);
					}
				});
				select.records[i] = records[i];
        }
        select.mapping = mapping;
    }
    _this.toolbar(select);
};
AppGridSelection.prototype.toolbar = function(data){
    var _this = this, grid = this.grid, style = {top: _this.position.top + _this.position.height + 15, left: _this.position.left, minWidth: _this.position.width - 6};
    var common = $('<div class="agtds-common" />');
    var len = 0, sum = 0, avg = 0, num = 0, row = 0, col = 0;
    _this.toolbar_html = $('<div id="agtds-toolbar" />').css(style).appendTo(grid.grid);
    $.each(data.records, function(index, record){
        row++;
        col = 0;
        $.each(record, function(field, value){
            if(data.mapping[field]){
                num++;
                col++;
                if(value && value.value && $.isNumeric(value.value)){
                    sum = APP_GRID_GLOBAL_OBJECT.add(sum, value.value);
                    len++;
                }
            }
        });
    });
    $.each(grid.def.selection.toolbar.custom, function(name, icon){
        common.append('<span class="agtds-span agtds-icons" _name="'+name+'">' + icon.text + '</span>');
    });
    grid.def.selection.toolbar.num && common.append('<span class="agtds-span">计数：' + row + '行 x ' + col + '列 = '+ num + '</span>');
    if(sum > 0){
        avg = sum / len;
        grid.def.selection.toolbar.sum && common.append('<span class="agtds-span">求和：' + sum.appGridNumber() + '</span>');
        grid.def.selection.toolbar.avg && common.append('<span class="agtds-span">平均：' + avg.appGridNumber() + '</span>');
        grid.def.selection.toolbar.exportexcel && common.prepend('<span class="agtds-btn" _name="exportexcel" title="'+grid.def.toolbar.exportexcel.title+'">'+grid.def.toolbar.exportexcel.text+'</span>');
        grid.def.selection.toolbar.linecharts && common.prepend('<span class="agtds-btn" _name="line" title="'+grid.def.toolbar.linecharts.title+'">'+grid.def.toolbar.linecharts.text+'</span>');
        grid.def.selection.toolbar.barcharts && common.prepend('<span class="agtds-btn" _name="bar" title="'+grid.def.toolbar.barcharts.title+'">'+grid.def.toolbar.barcharts.text+'</span>');
        grid.def.selection.toolbar.piecharts && common.prepend('<span class="agtds-btn" _name="pie" title="'+grid.def.toolbar.piecharts.title+'">'+grid.def.toolbar.piecharts.text+'</span>');
    }
    var trans_charts_columns = function(){
        var charts_columns = {}, charts_data = [];
        $.each(data.records, function(index, records){
            var tmp = {};
            $.each(records, function(field, record){
                if(data.mapping[field]){
                    if($.isNumeric(record.value)){
                        record.value = parseFloat(record.value);
                        tmp[field] = record;
                        !charts_columns[field] && (charts_columns[field] = {value: data.mapping[field].mapping[0], text:  data.mapping[field].title, type: 'number'});
                    }else{
                        if(typeof record.value == 'string'){
                            tmp[field] = record;
                            !charts_columns[field] && (charts_columns[field] = {value: data.mapping[field].mapping[0], text:  data.mapping[field].title, type: 'string'});
                        }
                    }
                }
            });
            if(!$.isEmptyObject(tmp)){
                charts_data.push(tmp);
                tmp = [];
            }
        });
        return {columns: charts_columns, data: charts_data};
    };
    common.delegate('.agtds-icons', 'click', function(){
        var name = $(this).attr('_name');
        if(name && grid.def.selection.toolbar.custom[name]){
            grid.def.selection.toolbar.custom[name].callback.call(null, data);
            return false;
        }
    }).delegate('.agtds-btn', 'click', function(){
        var name = $(this).attr('_name'), title = '', type = '';
        switch(name){
            case 'line':
                title = grid.def.toolbar.linecharts.text.filterHtml();
                type = 'spline';
                break;
            case 'bar':
                title = grid.def.toolbar.barcharts.text.filterHtml();
                type = 'column';
                break;
            case 'pie':
                title = grid.def.toolbar.piecharts.text.filterHtml();
                type = 'pie';
                break;
            case 'exportexcel':
                return AppGridAction.exportExcelSelection(grid, {records:data.records, index_to_field: data.index, field_to_items: data.mapping});
                break;
        }
        var dialog = new AppGridDialog({
            title: title,
            style: {width: '60%'},
            content: '<div id="app-grid-chart-block"></div>',
            cancel_txt: ''
        });
        dialog.render.find('.agt-dialog-confirm, .agt-dialog-close').click(function(){
            dialog.close();
        });
        var charts_data = trans_charts_columns();
        new DrawCharts({info: charts_data.data, columns: charts_data.columns, type: [type], div: 'app-grid-chart-block'});
        dialog.relocate(true);
    });
    _this.toolbar_html.append(common);
    if(_this.toolbar_html.outerWidth() + style.left > grid.width.grid){
        _this.toolbar_html.css({left: grid.width.grid - _this.toolbar_html.outerWidth()});
    }
};
AppGridSelection.prototype.close = function(){
    if(this.select_div){
        this.select_div.remove();
        this.select_div = null;
        this.toolbar_html && this.toolbar_html.remove();
        this.cover && this.cover.remove();
        this.grid.def.section.enable && $('body').css({'overflow': this.overflow});
    }
    $(document).off('.appselection');
};

//排序
AppGrid.prototype.sortable = function(){
    var _this = this;
    last_sort_column = _this.grid.find('.grid-sortable[_field="'+_this.def.sortable.sort_field+'"]');
    last_sort_column.removeClass('sort-unvisible');
    last_sort_column.removeClass('sort-asc').addClass('sort-' + _this.def.sortable.sort_asc);
    _this.grid.find('.agti-sort').click(function(){
        _this.def.sortable.sort_field = $(this).attr('_field');
        last_sort_column.addClass('sort-unvisible');
        last_sort_column = _this.grid.find('.grid-sortable[_field="'+_this.def.sortable.sort_field+'"]');
        if (last_sort_column.hasClass('sort-unvisible')) {
            last_sort_column.removeClass('sort-unvisible');
        }
        if (last_sort_column.hasClass('sort-asc')) {
            last_sort_column.removeClass('sort-asc').addClass('sort-desc');
            _this.def.sortable.sort_asc = 'desc';
        } else {
            last_sort_column.removeClass('sort-desc').addClass('sort-asc');
            _this.def.sortable.sort_asc = 'asc';
        }
        var params = {sort_field: _this.def.sortable.sort_field, sort_asc: _this.def.sortable.sort_asc};
        if(_this.def.sortable.proxy){
            if(_this.def.paginator.enable){
                params.page_index = _this.def.paginator.page_index;
                params.page_size = _this.def.paginator.page_size;
            }
            _this.def.sortable.proxy.call(_this, params);
        }else{
            _this.def.data.records.sort(function(current, next){
                if(current[params.sort_field].value == next[params.sort_field].value){
                    return 0;
                }
                if(current[params.sort_field].value > next[params.sort_field].value){
                    return params.sort_asc == 'asc' ? 1 : -1;
                }
                if(current[params.sort_field].value < next[params.sort_field].value){
                    return params.sort_asc == 'asc' ? -1 : 1;
                }
            });
            _this.reCalculatePaginator();
            _this.renderBody();
        }
    });
};

/**
 * 工具栏
 */
var AppGridToolbar = function(grid){
    this.grid = grid;
    var _this = this;
		_this.toolbar = $('<div class="agt-tool-block"/>').appendTo(grid.tool_holder.show());
    _this.charts_width = Math.ceil($(window).width() * 0.6);
    grid.def.toolbar.setting.enable && _this.setting();
    grid.def.toolbar.unfilter.enable && _this.unfilter();
    grid.def.toolbar.exportexcel.enable && _this.exportExcel();
    grid.def.toolbar.remove.enable && _this.remove();
    grid.def.toolbar.linecharts.enable && _this.linecharts();
    grid.def.toolbar.barcharts.enable && _this.barcharts();
    grid.def.toolbar.piecharts.enable && _this.piecharts();
    _this.custom();
};
AppGridToolbar.prototype.remove = function(){
    var _this = this, grid = this.grid;
    var icon = $('<span class="agtt-icon-place" title="'+grid.def.toolbar.remove.title+'">'+grid.def.toolbar.remove.text+'</span>');
    icon.appendTo(_this.toolbar);
    icon.click(function(){
        var checked = grid.get.checked();
        if(checked.index.length){
            AppGridAction.remove(checked.index);
        }
    });
};
AppGridToolbar.prototype.exportExcel = function(){
    var _this = this, grid = this.grid;

    var iframe = '';
    if(grid.def.toolbar.exportexcel.url)
    {
        var id="export_excel_"+Math.ceil(Math.random()*10000)+'_'+Math.ceil(Math.random()*10000);
        iframe = '<div style="display:none">\
        <iframe id="'+id+'" name="'+id+'" src=""></iframe>\
        <form class="export_excel_form" method="post" encType="multipart/form-data" action="'+grid.def.toolbar.exportexcel.url+'" target="'+id+'">\
        <input class="export_excel_data" type="hidden" name="xls" value="">\
        <input class="export_excel_filename" type="hidden" name="filename" value="">\
        <input type="hidden" name="_csrf" value="'+(typeof(get_csrf_token)!='undefined'?get_csrf_token():'')+'"></form>\
        </div>';
    }    

    var icon = $('<span class="agtt-icon-place" title="'+grid.def.toolbar.exportexcel.title+'">'+grid.def.toolbar.exportexcel.text+iframe+'</span>');
    icon.appendTo(_this.toolbar);
    icon.click(function(){
        AppGridAction.exportExcel(grid);
    });
};
AppGridToolbar.prototype.setting = function(){
    var _this = this, grid = this.grid;
    var icon = $('<span class="agtt-icon-place" title="'+grid.def.toolbar.setting.title+'">'+grid.def.toolbar.setting.text+'</span>');
    icon.appendTo(_this.toolbar);
    icon.click(function(){
        new AppGridColumnsSetting({grid: grid, setting: {width: 540}});
    });
};
AppGridToolbar.prototype.unfilter = function(){
    var _this = this, grid = this.grid;
    if(grid.item_operate !== undefined){
        var icon = $('<span class="agtt-icon-place" title="'+grid.def.toolbar.unfilter.title+'">'+grid.def.toolbar.unfilter.text+'</span>');
        icon.appendTo(_this.toolbar);
        icon.click(function(){
            grid.item_operate.holder = {};
            grid.item_operate.doFilterAction();
        });
    }
};
AppGridToolbar.prototype.linecharts = function(){
    var _this = this, grid = this.grid;
    _this.icon_linecharts = $('<span class="agtt-icon-place" title="'+grid.def.toolbar.linecharts.title+'">'+grid.def.toolbar.linecharts.text+'</span>');
    _this.icon_linecharts.appendTo(_this.toolbar);
    _this.icon_linecharts.click(function(){
        var charts_data = _this.chartsColumns();
        AppGridAction.linechart(grid, {width: _this.charts_width, charts_data: charts_data});
    });
};
AppGridToolbar.prototype.piecharts = function(){
    var _this = this, grid = this.grid;
    _this.icon_piecharts = $('<span class="agtt-icon-place" title="'+grid.def.toolbar.piecharts.title+'">'+grid.def.toolbar.piecharts.text+'</span>');
    _this.icon_piecharts.appendTo(_this.toolbar);
    _this.icon_piecharts.click(function(){
        var charts_data = _this.chartsColumns();
        AppGridAction.piechart(grid, {width: _this.charts_width, charts_data: charts_data});
    });
};
AppGridToolbar.prototype.barcharts = function(){
    var _this = this, grid = this.grid;
    _this.icon_barcharts = $('<span class="agtt-icon-place" title="'+grid.def.toolbar.barcharts.title+'">'+grid.def.toolbar.barcharts.text+'</span>');
    _this.icon_barcharts.appendTo(_this.toolbar);
    _this.icon_barcharts.click(function(){
        var charts_data = _this.chartsColumns();
        AppGridAction.barchart(grid, {width: _this.charts_width, charts_data: charts_data});
    });
};
AppGridToolbar.prototype.custom = function(){
    var _this = this, grid = this.grid;
    $.each(grid.def.toolbar.custom, function(name, icon){
        if(icon.before && icon.before.call(null) !== true){
            return true;
        }
        var text = $('<span class="agtt-icon-self-place" />').css(icon.style ? icon.style : {});
        text.append(icon.text).appendTo(_this.toolbar);
        icon.callback && text.click(function(){
            if(icon.data){
                var checked = grid.get.checked();
                if(checked.index.length){
                    icon.callback.call(null, checked.records);
                }else{
                    icon.callback.call(null, grid.get.records());
                }
            }else{
                icon.callback.call(null);
            }
        });
        icon.after && icon.after.call(null);
    });
};
AppGridToolbar.prototype.chartsColumns = function(){
    var charts_columns = {}, grid = this.grid, charts_data = {}, checked = grid.get.checked(), records = {};
    checked.index.length ? (records = checked.records) : (records = grid.get.records());
    $.each(records, function(index, record){
        var tmp = {};
        $.each(record, function(field, item){
            if(grid.field_to_items[field]){
                if($.isNumeric(item.value)){
                    tmp[field] = item;
                    !charts_columns[field] && (charts_columns[field] = {value: field, text:  grid.field_to_items[field].title, type: 'number'});
                }else{
                    if(typeof item.value == 'string'){
                        tmp[field] = item;
                        !charts_columns[field] && (charts_columns[field] = {value: field, text:  grid.field_to_items[field].title, type: 'string'});
                    }
                }
            }
        });
        !$.isEmptyObject(tmp) && (charts_data[index] = tmp);
    });
    return {columns: charts_columns, data: charts_data};
};

var AppGridUtilityC = function(params){
    this.items = params.items;
    this.render = params.render;
    this.callback = params.callback ? params.callback : null;
    this.style = params.style ? params.style : 'margin-right:5px;display:inline-block;';
    this.title = params.title;
    this.dic = {};
    this.init();
};
AppGridUtilityC.prototype.init = function(){
    var _self = this, content = [];
    content.push('<div class="agtc-box">');
    $.each(this.items, function(index, item){
        _self.dic[item.value] = item.text;
        content.push('<span value="'+item.value+'" title="'+(_self.title ? (item.title ? item.title : item.text ? item.text : '') : '')+'" style="'+_self.style+'" class="agtc-box-label agt-text-overflow"><span class="agt-icon '+(item.locked ? 'agti-checked agti-check-locked' : (item.disabled ? 'agti-check-disabled' : 'agti-check'))+'" _value="'+item.value+'"></span><span class="agtc-box-text">'+item.text+'</span></span>');
    });
    content.push('</div">');
    $(this.render).undelegate('.agt-icon', 'click');
    $(this.render).empty().append(content.join('')).delegate('.agt-icon', 'click', function(){
        var _tar = $(this);
        if(_tar.hasClass('agti-check-disabled') || _tar.hasClass('agti-check-locked')){
            return false;
        }
        _tar.hasClass('agti-check') ? _tar.removeClass('agti-check').addClass('agti-checked') : _tar.removeClass('agti-checked').addClass('agti-check');
        if(_self.callback){
            var _v = _tar.attr('_value'), text = _self.dic[_v];
            if(text === undefined){
                text = _tar.next().text();
            }
            var result = {item: {value: _v, text: text}, values: _self.get(), checked: _tar.hasClass('agti-checked') ? true : false};
            _self.callback.call(_self, result);
        }
    });
};
AppGridUtilityC.prototype.get = function(){
    var _self = this, value = [];
    $(this.render).find('.agti-checked').each(function(){
        var _v = $(this).attr('_value'), text = _self.dic[_v];
        if(text === undefined){
            text = $(this).next().text();
        }
        value.push({value: _v, text: text});
    });
    return value;
};
AppGridUtilityC.prototype.setLocked = function(values, enable){
    var _self = this;
    $.each(values, function(i, v){
        if(enable){
            $(_self.render).find('.agt-icon[_value="'+v+'"]').removeClass('agti-check-locked').addClass('agti-check');
        }else{
            $(_self.render).find('.agt-icon[_value="'+v+'"]').removeClass('agti-check agti-check-disabled').addClass('agti-checked agti-check-locked');
        }
    });
};
AppGridUtilityC.prototype.setDisable = function(values, enable){
    var _self = this;
    $.each(values, function(i, v){
        if(enable){
            $(_self.render).find('.agt-icon[_value="'+v+'"]').removeClass('agti-check-disabled').addClass('agti-check');
        }else{
            $(_self.render).find('.agt-icon[_value="'+v+'"]').removeClass('agti-check agti-checked agti-check-locked').addClass('checkbox-disabled');
        }
    });
};
AppGridUtilityC.prototype.setAll = function(){
    $(this.render).find('.agt-icon').each(function(){
        var _this = $(this);
        if(_this.hasClass('agti-check-disabled') || _this.hasClass('agti-check-locked')){
            return true;
        }
        _this.removeClass('agti-check').addClass('agti-checked');
    });
};
AppGridUtilityC.prototype.setNone = function(){
    $(this.render).find('.agt-icon').each(function(){
        var _this = $(this);
        if(_this.hasClass('agti-check-disabled') || _this.hasClass('agti-check-locked')){
            return true;
        }
        _this.removeClass('agti-checked').addClass('agti-check');
    });
};
AppGridUtilityC.prototype.reverseAll = function(){
    $(this.render).find('.agt-icon').each(function(){
        var _this = $(this);
        if(_this.hasClass('agti-check-disabled') || _this.hasClass('agti-check-locked')){
            return true;
        }
        _this.hasClass('agti-checked') ?
        _this.removeClass('agti-checked').addClass('agti-check') :
        _this.removeClass('agti-check').addClass('agti-checked');
    });
};
AppGridUtilityC.prototype.reset = function(values){
    var _self = this;
    if(values.length){
        $.each(values, function(i, v){
            var target = $(_self.render).find('.agt-icon[_value="'+v+'"]');
            (!target.hasClass('agti-check-locked') || !target.hasClass('agti-check-disabled')) && target.removeClass('agti-checked').addClass('agti-check');
        });
    }else{
        var target = $(_self.render).find('.agt-icon');
        (!target.hasClass('agti-check-locked') || !target.hasClass('agti-check-disabled')) && target.removeClass('agti-checked').addClass('agti-check');
    }
};
AppGridUtilityC.prototype.set = function(values){
    var _self = this;
    $(_self.render).find('.agt-icon').each(function(){
        var _this = $(this);
        if(_this.hasClass('agti-check-disabled') || _this.hasClass('agti-check-locked')){
            return true;
        }
        _this.removeClass('agti-checked').addClass('agti-check');
    });
    $.each(values, function(i, v){
        var target = $(_self.render).find('.agt-icon[_value="'+v+'"]');
        (!target.hasClass('agti-check-locked') || !target.hasClass('agti-check-disabled')) && target.removeClass('agti-check').addClass('agti-checked');
    });
};

var AppGridUtilityR = function(setting){
    this.items = setting.items;
    this.render = setting.render;
    this.callback = setting.callback ? setting.callback : null;
    this.value = setting.value ? setting.value : null;
    this.style = setting.style ? setting.style : 'margin-right:10px;display:inline-block;';
    this.title = setting.title;
    this.dic = {};
    this.init();
};
AppGridUtilityR.prototype.init = function(){
    var _self = this;
    var content = new Array();
    content.push('<div class="agrc-box">');
    $.each(_self.items, function(index, item){
        _self.dic[item.value] = item.text;
        if(_self.value && _self.value.value == item.value ){
            content.push('<span title="'+(_self.title ? (item.title ? item.title : item.text ? item.text : '') : '')+'" style="'+_self.style+'" class="agrc-box-label" _value="'+item.value+'"><span class="agt-icon agti-radio agti-radio-check"></span>'+item.text+'</span>');
        }else{
            content.push('<span title="'+(_self.title ? (item.title ? item.title : item.text ? item.text : '') : '')+'" style="'+_self.style+'" class="agrc-box-label" _value="'+item.value+'"><span class="agt-icon agti-radio"></span>'+item.text+'</span>');
        }
    });
    content.push('</div">');
    $(this.render).undelegate('.agrc-box-label', 'click');
    $(this.render).empty().append(content.join('')).delegate('.agrc-box-label', 'click', function(){
        var _this = $(this);
        var value = _this.attr('_value');
        if(_self.value && value == _self.value.value){
            return false;
        }
        _self.value = {value: value, text: _self.dic[value]};
        _this.children().addClass('agti-radio-check').end().siblings().find('.agt-icon').removeClass('agti-radio-check');
        _self.callback && _self.callback.call(_self, _self.value);
    });
};
AppGridUtilityR.prototype.get = function(){
    return this.value;
};
AppGridUtilityR.prototype.set = function(value, callback){
    $(this.render).find('.agt-icon').removeClass('agti-radio-check');
    if(callback === true){
        $(this.render).find('.agrc-box-label[_value="'+value+'"]').click();
    }else{
        this.value = {value: value, text: this.dic[value] ? this.dic[value] : value};
        $(this.render).find('.agrc-box-label[_value="'+value+'"]').children().addClass('agti-radio-check');
    }
};
AppGridUtilityS = function(setting){
    var def = {
            id: '#agt-select',
            items: [], //{text: '', value: ''}
            value: '',
            width: 100,
            height: 'auto',
            show: false,
            body: false,
            remove: false,
            position: null,
            textval: null,
            callback: null
    };
    this.def = $.extend(true, def, setting);
    this.items_map = {};
    this.init();
};
AppGridUtilityS.prototype.init = function(){
    var _self = this;
    _self.select_el = $('<div/>').addClass('agts').bind('click', function(e){APP_GRID_GLOBAL_OBJECT.clear(e);});
    if(_self.def.textval){
        _self.select_el.append(_self.select_textval = _self.def.textval.bind('click', function(){_self.toggle();}));
    }else{
        _self.select_el.append(_self.select_text = $('<div class="agts-text"><span onselectstart="return false;" class="agts-val"></span></div>').css({width: _self.def.width - 16}).bind('click', function(){_self.toggle();}));
        _self.select_textval = _self.select_el.find('.agts-val');
    }
    _self.select_el_item_list = $('<ol class="agts-dropdown" _expand="0" />').css({width: _self.def.width, height: _self.def.height}).appGridHoverClass('li', 'hover').delegate('.agts-li', 'click', function() {
        var value = $(this).attr('_value');
        $(this).addClass('selected').siblings('.agts-li').removeClass('selected');
        _self.hide(true);
        _self.def.value = value;
        _self.select_textval.text(_self.items_map[value]);
        _self.def.callback && _self.def.callback.call(null, {value: value, text: _self.items_map[value]}, _self.def.name);
    });
    var object_val = [];
    $.each(_self.def.items, function(index, item) {
        _self.items_map[item.value] = item.text;
        object_val.push('<li class="agts-li '+(item.value == _self.def.value ? 'selected' : '')+'" _value="'+item.value+'" title="'+item.text+'">'+item.text+'</li>');
    });
    _self.select_el_item_list.empty().append(object_val.join(''));
    _self.select_textval.text(_self.items_map[_self.def.value]);
    _self.select_el.appendTo(_self.def.id);
    if(_self.def.body){
        _self.select_el_item_list.appendTo('body');
    }else{
        _self.select_el_item_list.appendTo(_self.select_el);
    }
    $('body').click(function(){
        _self.hide();
    });
    _self.def.show ? _self.show() : _self.hide();
};
AppGridUtilityS.prototype.set = function(value){
    if(this.items_map[value]){
        this.def.value = value;
        this.select_textval.text(this.items_map[value]);
        this.select_el_item_list.find('.agts-li').each(function(){
            if($(this).attr('_value') == value){
                $(this).addClass('selected');
            }else{
                $(this).removeClass('selected');
            }
        });
    }
};
AppGridUtilityS.prototype.get = function(){
    return {value: this.def.value, text: this.items_map[this.def.value]};
};
AppGridUtilityS.prototype.show = function(){
    $('.agts-dropdown').attr('_expand', '0').hide();
    this.select_el_item_list.attr('_expand', '1').show();
    if(this.def.body){
        var offset = this.select_el.offset();
        this.select_el_item_list.css({left: offset.left, top: offset.top + 28});
    }
};
AppGridUtilityS.prototype.toggle = function(){
    this.select_el_item_list.attr('_expand') == '1' ? this.hide() : this.show();
};
AppGridUtilityS.prototype.hide = function(sign){
    this.def.remove && sign ? this.select_el_item_list.remove() : this.select_el_item_list.attr('_expand', '0').hide();
};
/**
 * 对话框
 */
var AppGridDialog = function(setting){
    var def = {
        title : '自定义列',
        style : {width: 300},
        confirm_txt : '确认',
        cancel_txt : '取消',
        content : ''
    };
    this.config = $.extend(true, {}, def, setting);
    this.init();
};
AppGridDialog.prototype.init = function(){
    var config = this.config, content = [];
    content.push('<div class="agt-dialog-head">'+config.title+'<span class="agt-dialog-close">×</span></div>');
    content.push('<div class="agt-dialog-body">'+config.content+'</div><div class="agt-dialog-foot">');
    if(config.confirm_txt){
        content.push('<span class="agt-dialog-confirm">'+config.confirm_txt+'</span>');
    }
    if(config.cancel_txt){
        content.push('<span class="agt-dialog-cancel">'+config.cancel_txt+'</span>');
    }
    content.push('</div>');
    this.render = $('<div class="agt-dialog">').css(config.style);
    this.render.append(content.join('')).appendTo('body');
    this.changeFade({'display': 'block'});
    this.relocate();
};
AppGridDialog.prototype.close = function(){
    this.changeFade({'display': 'none'});
    this.render.remove();
};
AppGridDialog.prototype.relocate = function(animate, callback){
    var target = this.render, scrollPos = this.getScrollXY(), clientSize = this.getClientWH(), tdel = {'x': target.width(), 'y': target.height()};
    var top = (clientSize.h / 2 + scrollPos.y - tdel.y / 2);
    var left = (clientSize.w / 2 + scrollPos.x - tdel.x / 2);
    if(top < 10){
        top = 10;
    }
    if(top - 50 >= 5){
        top = top - 50;
    }
    if(animate){
        target.animate({top: top, left: left}, "normal", 'swing', function(){
            callback && callback();
        });
    }else{
        target.css({top: top, left: left});
    }
};
AppGridDialog.prototype.changeFade = function(style){
    if($('#agt-overlay').length == 0){
        $('body').append('<div id="agt-overlay"></div>');
    }
    $("#agt-overlay").css(style);
};
AppGridDialog.prototype.getScrollXY = function(){
    var scrollLeft = window.pageXOffset
    || document.documentElement.scrollLeft
    || document.body.scrollLeft
    || 0;
    var scrollTop = window.pageYOffset
    || document.documentElement.scrollTop
    || document.body.scrollTop
    || 0;
    var resObj = new Object();
    resObj.x = scrollLeft;
    resObj.y = scrollTop;
    return resObj;
};
AppGridDialog.prototype.getClientWH = function(){
    var clientWidth = document.documentElement.clientWidth
    || document.body.clientWidth
    || 0;
    var clientHeight = document.documentElement.clientHeight
    || document.body.clientHeight
    || 0;
    var resObj = new Object();
    resObj.w = clientWidth;
    resObj.h = clientHeight;
    return resObj;
};