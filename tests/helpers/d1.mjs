import {DatabaseSync} from 'node:sqlite';

// A real SQLite execution adapter for the subset of Cloudflare D1 used by Trip.
// Tests exercise SQL, constraints and transactions rather than a Map-shaped mock.
export function createD1(filename=':memory:'){
 const sqlite=new DatabaseSync(filename);
 sqlite.exec('PRAGMA foreign_keys = ON');
 const statement=(sql,values=[])=>{
  const prepared=()=>sqlite.prepare(sql);
  function metadata(){
   const row=sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get();
   return {changes:Number(row.changes),last_row_id:Number(row.last_row_id),duration:0,rows_read:0,rows_written:Number(row.changes),size_after:0,changed_db:Number(row.changes)>0};
  }
  const entry={
   bind(...parameters){return statement(sql,parameters)},
   async first(column){const value=prepared().get(...values);if(!value)return null;return column===undefined?{...value}:value[column]??null},
   async all(){const results=prepared().all(...values).map(row=>({...row}));return {success:true,results,meta:metadata()}},
   async run(){const result=prepared().run(...values);return {success:true,results:[],meta:{...metadata(),changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}},
   async raw(options){const columns=prepared().columns().map(c=>c.name);const results=prepared().all(...values).map(row=>columns.map(c=>row[c]));return options?.columnNames?[columns,...results]:results},
   _execute(){
    if(prepared().columns().length){const results=prepared().all(...values).map(row=>({...row}));return {success:true,results,meta:metadata()}}
    const result=prepared().run(...values);return {success:true,results:[],meta:{...metadata(),changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};
   },
  };
  return entry;
 };
 const binding={
  prepare(sql){return statement(sql)},
  async exec(sql){sqlite.exec(sql);return {count:1,duration:0}},
  async batch(statements){
   sqlite.exec('BEGIN IMMEDIATE');
   try{const output=statements.map(s=>s._execute());sqlite.exec('COMMIT');return output}
   catch(error){sqlite.exec('ROLLBACK');throw error}
  },
 };
 return {db:binding,sqlite,close:()=>sqlite.close()};
}
